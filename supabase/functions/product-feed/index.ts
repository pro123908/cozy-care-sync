import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Public, unauthenticated CSV feed for Meta Commerce Manager's "Upload a data
// file" → scheduled-fetch flow (Catalog → Settings → Products). Meta re-pulls
// this URL on its own schedule, so the WhatsApp/Facebook/Instagram catalog
// stays in sync with the `products` table with no manual re-upload.
//
// Field spec: https://www.facebook.com/business/help/120325381656392
// (same schema Google Merchant feeds use — id/title/description/availability/
// condition/price/link/image_link required, brand/sale_price/product_type
// recommended).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STOREFRONT_URL = Deno.env.get("STOREFRONT_URL") || "https://wellcaremart.pk";

type ProductRow = {
  id: string;
  name: string;
  brand: string;
  cat: string;
  price: number;
  was: number | null;
  image_url: string | null;
  blurb: string;
  active: boolean;
  stock_count: number;
};

type CategoryRow = { slug: string; name: string };

// Ported verbatim from src/wcm/data.ts (slugifySegment + getProductSeoPathSegment)
// so feed links resolve to the exact same URLs the storefront itself renders —
// this can't import that module directly since edge functions run standalone.
function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function getProductSeoPathSegment(product: ProductRow, allProducts: ProductRow[]): string {
  const nameSlug = slugifySegment(product.name);
  const idSlug = slugifySegment(product.id);
  const baseSlug = nameSlug || idSlug;
  if (!baseSlug) return "product";

  const sameBase = allProducts
    .filter((candidate) => {
      const candidateBase = slugifySegment(candidate.name) || slugifySegment(candidate.id);
      return candidateBase === baseSlug;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  if (sameBase.length <= 1) return baseSlug;

  const index = sameBase.findIndex((candidate) => candidate.id === product.id);
  if (index <= 0) return baseSlug;
  return `${baseSlug}-${index + 1}`;
}

function csvField(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function pkr(amount: number): string {
  return `${amount.toFixed(2)} PKR`;
}

const COLUMNS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "sale_price",
  "link",
  "image_link",
  "brand",
  "product_type",
] as const;

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [productsResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, brand, cat, price, was, image_url, blurb, active, stock_count")
      .range(0, 1999),
    supabase.from("categories").select("slug, name"),
  ]);

  if (productsResult.error) {
    return new Response(`Failed to load products: ${productsResult.error.message}`, { status: 500 });
  }

  const allRows = (productsResult.data || []) as ProductRow[];
  const categoryName = new Map<string, string>(
    ((categoriesResult.data || []) as CategoryRow[]).map((c) => [c.slug, c.name]),
  );

  // Meta requires a non-empty image_link on every row — a product missing an
  // image would just get rejected item-by-item, so drop those instead of
  // submitting known-bad rows every fetch cycle.
  const rows = allRows.filter((p) => Boolean(p.image_url));

  // Slugs must be computed against the same product set the storefront itself
  // loads (active only — see src/wcm/context.tsx) so links for active
  // products resolve correctly. Inactive rows are still included in the feed
  // (marked "out of stock" below) but their link may not resolve to a live
  // page — acceptable since they're already flagged unavailable.
  const activeForSlugs = rows.filter((p) => p.active);

  const lines = [COLUMNS.join(",")];

  for (const p of rows) {
    const inStock = p.active && p.stock_count > 0;
    const onSale = p.was !== null && p.was > p.price && p.price > 0;
    const slug = getProductSeoPathSegment(p, p.active ? activeForSlugs : [...activeForSlugs, p]);

    const row = {
      id: p.id,
      title: p.name,
      description: p.blurb?.trim() || `${p.brand} ${p.name}`.trim(),
      availability: inStock ? "in stock" : "out of stock",
      condition: "new",
      price: pkr(onSale ? (p.was as number) : p.price),
      sale_price: onSale ? pkr(p.price) : "",
      link: `${STOREFRONT_URL}/products/${slug}`,
      image_link: p.image_url || "",
      brand: p.brand || "Well Care Mart",
      product_type: categoryName.get(p.cat) || p.cat,
    };

    lines.push(COLUMNS.map((col) => csvField(row[col])).join(","));
  }

  return new Response(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
});
