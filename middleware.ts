/// <reference types="node" />
import { next } from "@vercel/functions";
import {
  CATEGORIES,
  PKR,
  getDisplayPrice,
  getProductSeoPathSegment,
  resolveProductIdFromParam,
  type Category,
  type Product,
} from "./src/wcm/data";

// Human-facing pages (no extension — mirrors vercel.json's SPA rewrite
// regex), plus /sitemap.xml explicitly since it has one and would otherwise
// be excluded and fall straight to the static public/sitemap.xml file.
export const config = {
  matcher: ["/((?!.*\\..*).*)", "/sitemap.xml"],
};

// Public content pages with no dynamic id segment — kept in one place so the
// sitemap and any future full-site listing stay in sync.
const STATIC_PAGES = ["/", "/about", "/categories", "/prescription", "/faqs", "/policies", "/map", "/deals"];

// Known-crawler UA substrings — kept as a secondary/explicit signal, but not
// the primary one. A UA allowlist only catches bots that *choose* to
// self-identify; a plain non-JS HTTP client (curl, python-requests, most
// generic "fetch this URL" tools) sends a UA that matches none of these and
// would otherwise fall through to the empty SPA shell, which is exactly the
// bug this list alone caused (confirmed 2026-07-24: python-requests UA still
// got the 2.8KB static shell in production).
const BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|linkedinbot|twitterbot|pinterest|embedly|quora link preview|redditbot|applebot|bingpreview|gptbot|chatgpt-user|oai-searchbot|perplexitybot|claudebot|anthropic-ai|ccbot|bytespider|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|yandexbot|baiduspider|duckduckbot|sogou|exabot|ia_archiver/i;

// Primary signal: real interactive browsers (Chrome/Firefox/Safari/Edge —
// all evergreen for years) send Fetch Metadata request headers, including
// `Sec-Fetch-Mode: navigate`, on every top-level page load. No script, curl,
// HTTP client library, or headless-fetch tool sends this unless it's
// deliberately impersonating a browser. Its absence is a much more reliable
// "this is not a JS-executing browser" signal than any UA string list, so it
// is treated as sufficient on its own — the UA list above only adds known
// bots back in on the rare chance a crawler *does* send Sec-Fetch-Mode.
function isNonInteractiveFetcher(request: Request): boolean {
  const userAgent = request.headers.get("user-agent") || "";
  if (!request.headers.get("sec-fetch-mode")) return true;
  return BOT_UA_PATTERN.test(userAgent);
}

const SITE_URL = "https://wellcaremart.pk";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// A few minutes of edge caching is fine for crawler traffic — they don't
// need second-fresh prices, and it keeps Supabase load negligible since real
// users never hit this path (they get `next()` below, unchanged).
const CACHE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
  // Belt-and-suspenders: makes explicit to any caching layer that this
  // response must not be reused for a request with a different UA/fetch
  // signature — a real browser must never be served the non-interactive page.
  vary: "User-Agent, Sec-Fetch-Mode",
};

type LiveProduct = Product;

async function fetchProducts(): Promise<LiveProduct[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,brand,cat,price,was,stock,blurb,image_url,tags,delivered_sales_count,size_options,variant_options&active=eq.true&order=sort_order.asc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      cat: r.cat,
      price: r.price,
      was: r.was ?? undefined,
      rating: 0,
      reviews: 0,
      delivered_sales_count: Number(r.delivered_sales_count ?? 0),
      stock: r.stock,
      tags: r.tags ?? [],
      blurb: r.blurb,
      swatch: "",
      image_url: r.image_url ?? undefined,
      size_options: Array.isArray(r.size_options) ? r.size_options : [],
      variant_options: Array.isArray(r.variant_options) ? r.variant_options : [],
    }));
  } catch {
    return [];
  }
}

async function fetchCategories(): Promise<Category[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return CATEGORIES;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/categories?select=id,name,slug,image_url,top_category&order=sort_order.asc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    );
    if (!res.ok) return CATEGORIES;
    const rows = (await res.json()) as any[];
    if (!rows.length) return CATEGORIES;
    return rows.map((r) => ({ id: r.id, name: r.name, count: 0, image_url: r.image_url ?? undefined }));
  } catch {
    return CATEGORIES;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pageShell(opts: {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  bodyHtml: string;
  jsonLd?: unknown;
}): string {
  const { title, description, canonical, ogImage, bodyHtml, jsonLd } = opts;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${ogImage || `${SITE_URL}/og-image.png`}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="robots" content="index, follow" />
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ""}
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
${bodyHtml}
</main>
</body>
</html>`;
}

function productCardHtml(p: LiveProduct, allProducts: LiveProduct[]): string {
  const slug = getProductSeoPathSegment(p, allProducts);
  const price = PKR(getDisplayPrice(p));
  const wasHtml = p.was && p.was > p.price ? `<s>${PKR(p.was)}</s> ` : "";
  return `<li>
  <a href="/products/${slug}">
    ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" width="120" />` : ""}
    <h3>${escapeHtml(p.name)}</h3>
    <p>${wasHtml}${price}</p>
    ${p.stock === "Out of stock" ? "<p>Out of stock</p>" : ""}
  </a>
</li>`;
}

function renderHome(products: LiveProduct[], categories: Category[]): string {
  const featured = [...products]
    .sort((a, b) => (b.delivered_sales_count ?? 0) - (a.delivered_sales_count ?? 0))
    .slice(0, 16);

  const categoriesHtml = categories
    .map((c) => `<li><a href="/categories/${c.id}">${escapeHtml(c.name)}</a></li>`)
    .join("");

  const productsHtml = featured.map((p) => productCardHtml(p, products)).join("");

  return pageShell({
    title: "Wellcare Mart — Medical Supplies & Equipment",
    description:
      "Shop trusted medical supplies, monitoring devices, and wellness essentials. Free same-day delivery in Karachi on orders above Rs 2,000.",
    canonical: `${SITE_URL}/`,
    bodyHtml: `
<p>Shop trusted medical supplies, monitoring devices, and wellness essentials. Free same-day delivery in Karachi on orders above Rs 2,000.</p>
<h2>Categories</h2>
<ul>${categoriesHtml}</ul>
<h2>Popular products</h2>
<ul>${productsHtml}</ul>`,
  });
}

// Static-content pages (no Supabase lookup) — text mirrors the live
// src/routes/*.tsx components. Kept as a second copy here rather than a
// shared import because these are JSX components with inline styling; if
// the copy wording changes, update both. Low churn risk (about/faqs/map
// text rarely changes) so the duplication is acceptable for now.
function renderAbout(): string {
  return pageShell({
    title: "About Wellcare Mart",
    description: "Learn about Wellcare Mart — Pakistan's trusted home healthcare products store.",
    canonical: `${SITE_URL}/about`,
    bodyHtml: `
<p>Wellcare Mart is focused on making home healthcare products easier to discover, compare, and order. We help families, caregivers, and clinics find trusted solutions for daily monitoring, mobility, respiratory care, and recovery support.</p>
<h2>What we do</h2>
<p>We curate practical medical and wellness essentials, keep availability updated, and provide a smooth checkout and order tracking experience.</p>
<h2>Our promise</h2>
<p>Reliable products, transparent information, and responsive customer support.</p>`,
  });
}

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How can I track my order?",
    a: "Go to Orders from your account and open the order details page to see current status updates.",
  },
  {
    q: "What are your delivery timelines?",
    a: "Most orders are delivered within 3 to 5 working days depending on your city and product availability.",
  },
  { q: "Can I return a product?", a: "Yes, eligible products can be returned according to our Returns & Refund policy." },
  {
    q: "How do I contact support?",
    a: "You can use the Contact/Map page for location details and support channels.",
  },
  {
    q: "Are product images and descriptions accurate?",
    a: "We try to keep listings up to date. Minor packaging or brand updates may vary by batch.",
  },
];

function renderFaqs(): string {
  const itemsHtml = FAQS.map((item) => `<h2>${escapeHtml(item.q)}</h2><p>${escapeHtml(item.a)}</p>`).join("\n");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  return pageShell({
    title: "FAQs - Wellcare Mart",
    description: "Frequently asked questions about orders, delivery, returns, and products at Wellcare Mart.",
    canonical: `${SITE_URL}/faqs`,
    jsonLd,
    bodyHtml: `<p>Quick answers about orders, shipping, returns, and support.</p>\n${itemsHtml}`,
  });
}

function renderMap(): string {
  return pageShell({
    title: "Store Location - Wellcare Mart",
    description: "Find Wellcare Mart's store location and get directions.",
    canonical: `${SITE_URL}/map`,
    bodyHtml: `
<p>Visit us or use map directions for pickup and support.</p>
<p><strong>Wellcare Mart</strong><br>Karachi, Pakistan</p>
<p><a href="https://www.google.com/maps">Open in Google Maps</a></p>`,
  });
}

function renderPolicies(): string {
  return pageShell({
    title: "Policies - Wellcare Mart",
    description: "Privacy, return/refund, shipping, and terms & conditions for Wellcare Mart.",
    canonical: `${SITE_URL}/policies`,
    bodyHtml: `
<h2>Privacy Policy</h2>
<p>Wellcare Mart respects your privacy. We collect basic customer information such as name, phone number, delivery address, and order details only for processing orders, deliveries, customer support, and service improvement.</p>
<p>We do not sell or misuse customer data. Customer information may only be shared with delivery partners or service providers when required to complete an order.</p>
<p>Customers can contact us anytime for questions related to their personal information.</p>
<h2>Return / Refund Policy</h2>
<p>At Wellcare Mart, we aim to provide reliable medical and healthcare products at affordable prices.</p>
<p>Returns &amp; exchanges are accepted only if the product is damaged, defective, or incorrect at delivery; the issue is reported within 24 hours of receiving the product; and the product is unused, unopened, and in its original packaging.</p>
<p>Due to the nature of medical and healthcare products, some items such as masks, gloves, diapers, hygiene products, disposable items, and personal-use medical products may not be returnable once opened or used.</p>
<p>Refunds, replacements, or exchanges will be processed after verification by our team.</p>
<h2>Shipping / Service Policy</h2>
<p>Wellcare Mart provides doorstep delivery of medical and healthcare products.</p>
<p>Orders are typically delivered within 3 to 5 working days, though delivery time may vary based on product availability, customer location, and courier service.</p>
<p>Customers will be contacted to confirm their order before dispatch. Delivery charges may apply depending on location and order size.</p>
<p>For urgent medical product requirements, customers are encouraged to contact us directly before placing an order.</p>
<h2>Terms &amp; Conditions</h2>
<p>By using the Wellcare Mart website or placing an order, customers agree that product prices and availability may change without prior notice; product images are for reference and may slightly differ from the actual product; customers are responsible for providing accurate contact and delivery details; Wellcare Mart reserves the right to cancel any order due to stock unavailability, pricing errors, or delivery limitations; medical equipment and healthcare products should be used according to manufacturer instructions or professional guidance; and Wellcare Mart is not responsible for misuse of any product after delivery.</p>
<h2>Contact Us</h2>
<p>Wellcare Mart<br>40 Darul Aman, Road 4, Block 3, Delhi Mercantile Society<br>+92 329 1557509<br>danialansari998@gmail.com</p>`,
  });
}

function renderPrescription(): string {
  return pageShell({
    title: "Upload Prescription — Wellcare Mart",
    description: "Upload your prescription or medicine list and our team will review it and contact you for order confirmation.",
    canonical: `${SITE_URL}/prescription`,
    bodyHtml: `<p>Upload a photo or PDF of your prescription or medicine list, along with your contact details, and our team will review it and reach out to confirm your order.</p>`,
  });
}

function renderCategoriesIndex(categories: Category[]): string {
  const itemsHtml = categories
    .map((c) => `<li><a href="/categories/${c.id}">${escapeHtml(c.name)}</a></li>`)
    .join("");
  return pageShell({
    title: "Shop by Category — Wellcare Mart",
    description: "Browse all product categories at Wellcare Mart.",
    canonical: `${SITE_URL}/categories`,
    bodyHtml: `<ul>${itemsHtml}</ul>`,
  });
}

function renderCategory(rawCategoryId: string, products: LiveProduct[], categories: Category[]): string | null {
  const resolvedCategoryId =
    rawCategoryId === "weight-scale-digital" || rawCategoryId === "weight-scale-manual"
      ? "weight-scale"
      : rawCategoryId === "ortho-belts" || rawCategoryId === "supports"
        ? "orthobelts-supports"
        : rawCategoryId;

  const category =
    categories.find((c) => c.id === resolvedCategoryId) ||
    (resolvedCategoryId === "orthobelts-supports"
      ? { id: "orthobelts-supports", name: "Orthobelts and Supports", count: 0 }
      : undefined);
  if (!category) return null;

  const categoryIds =
    resolvedCategoryId === "orthobelts-supports"
      ? ["orthobelts-supports", "ortho-belts", "supports"]
      : [resolvedCategoryId];

  const categoryProducts = products.filter((p) => categoryIds.includes(p.cat));
  const itemsHtml = categoryProducts.map((p) => productCardHtml(p, products)).join("");

  return pageShell({
    title: `${category.name} — Wellcare Mart`,
    description: `Browse ${category.name} products at Wellcare Mart.`,
    canonical: `${SITE_URL}/categories/${rawCategoryId}`,
    bodyHtml: categoryProducts.length ? `<ul>${itemsHtml}</ul>` : `<p>No products currently listed in this category.</p>`,
  });
}

function renderDeals(products: LiveProduct[]): string {
  const deals = products
    .filter((p) => p.was != null && p.was > p.price)
    .sort((a, b) => (1 - b.price / b.was!) - (1 - a.price / a.was!));
  const itemsHtml = deals.map((p) => productCardHtml(p, products)).join("");
  return pageShell({
    title: "Deals & Offers — Wellcare Mart",
    description: "Shop discounted medical supplies and equipment at Wellcare Mart.",
    canonical: `${SITE_URL}/deals`,
    bodyHtml: `<ul>${itemsHtml}</ul>`,
  });
}

function getSeoSuffix(cat?: string): string {
  switch (cat) {
    case "glucometers":
      return "Blood Glucose Meter";
    case "bp-digital":
      return "Digital Blood Pressure Monitor";
    case "bp-manual":
      return "Manual BP Apparatus";
    case "weight-scale":
      return "Weight Scale";
    case "nebulizer":
      return "Nebulizer";
    case "orthobelts-supports":
      return "Orthobelt";
    default:
      return "Medical Product";
  }
}

function renderProduct(rawProductId: string, products: LiveProduct[]): string | null {
  const resolvedId = resolveProductIdFromParam(rawProductId, products);
  const product = resolvedId ? products.find((p) => p.id === resolvedId) : undefined;
  if (!product) return null;

  const seoSuffix = getSeoSuffix(product.cat);
  const title = `${product.name} ${seoSuffix} — Wellcare Mart`;
  const description = product.blurb?.trim() || `${product.name} ${seoSuffix} available at Wellcare Mart with trusted delivery across Pakistan.`;
  const canonicalPath = getProductSeoPathSegment(product, products);
  const canonical = `${SITE_URL}/products/${canonicalPath}`;
  const price = PKR(getDisplayPrice(product));
  const wasHtml = product.was && product.was > product.price ? `<s>${PKR(product.was)}</s> ` : "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${product.name} ${seoSuffix}`,
    alternateName: product.name,
    description,
    brand: product.brand || undefined,
    sku: product.id,
    category: product.category_name || product.cat,
    url: canonical,
    image: product.image_url ? [product.image_url] : undefined,
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "PKR",
      price: product.price,
      availability: product.stock === "Out of stock" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };

  return pageShell({
    title,
    description,
    canonical,
    ogImage: product.image_url || undefined,
    jsonLd,
    bodyHtml: `
${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" width="320" />` : ""}
<p>${wasHtml}${price}</p>
<p>${escapeHtml(description)}</p>
${product.stock === "Out of stock" ? "<p>Out of stock</p>" : "<p>In stock</p>"}
${product.brand ? `<p>Brand: ${escapeHtml(product.brand)}</p>` : ""}
<p>Free same-day delivery in Karachi on orders above Rs 2,000.</p>`,
  });
}

// Regenerated live on every request (edge-cached for an hour) so new/renamed
// products are discoverable immediately instead of waiting on a manual
// regeneration of the old static public/sitemap.xml — confirmed 2026-07-24
// via Search Console that a real product was invisible to Google ("no
// referring sitemaps detected") because that file was frozen at 2026-06-12
// and never listed it.
async function renderSitemap(): Promise<Response | null> {
  const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);
  if (!products.length) return null;

  const urls = [
    ...STATIC_PAGES.map((path) => `${SITE_URL}${path}`),
    ...categories.map((c) => `${SITE_URL}/categories/${c.id}`),
    ...products.map((p) => `${SITE_URL}/products/${getProductSeoPathSegment(p, products)}`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `  <url><loc>${loc}</loc></url>`).join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      vary: "User-Agent, Sec-Fetch-Mode",
    },
  });
}

export default async function middleware(request: Request) {
  const url = new URL(request.url);

  if (url.pathname === "/sitemap.xml") {
    // Always dynamic regardless of fetcher type — a browser opening this URL
    // directly should see the same live list a crawler does. Falls back to
    // the static file (via next()) only if the live data fetch itself fails,
    // rather than ever serving an empty/broken sitemap.
    return (await renderSitemap()) || next();
  }

  if (!isNonInteractiveFetcher(request)) {
    return next();
  }

  const pathname = url.pathname;

  const productMatch = pathname.match(/^\/products\/([^/]+)\/?$/);
  const categoryMatch = pathname.match(/^\/categories\/([^/]+)\/?$/);

  let html: string | null = null;

  if (pathname === "/") {
    const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);
    html = renderHome(products, categories);
  } else if (pathname === "/categories" || pathname === "/categories/") {
    html = renderCategoriesIndex(await fetchCategories());
  } else if (categoryMatch) {
    const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);
    html = renderCategory(decodeURIComponent(categoryMatch[1]), products, categories);
  } else if (pathname === "/deals" || pathname === "/deals/") {
    html = renderDeals(await fetchProducts());
  } else if (productMatch) {
    html = renderProduct(decodeURIComponent(productMatch[1]), await fetchProducts());
  } else if (pathname === "/about") {
    html = renderAbout();
  } else if (pathname === "/faqs") {
    html = renderFaqs();
  } else if (pathname === "/map") {
    html = renderMap();
  } else if (pathname === "/policies") {
    html = renderPolicies();
  } else if (pathname === "/prescription") {
    html = renderPrescription();
  } else {
    // Any other route (checkout, account, orders, search, etc.) is either
    // not content-bearing or has data that shouldn't be rendered for
    // arbitrary bots — leave it to the normal SPA shell.
    return next();
  }

  if (!html) return next();

  return new Response(html, { headers: CACHE_HEADERS });
}
