import type { Product } from "./data";

// "You may also like" on the product page: the most similar products first.
//
// Candidates are only products in the same category or from the same (real) brand,
// so scoring can reorder them but never pulls in an unrelated one (a hearing-aid
// page must not show breast pumps just because both say "rechargeable"). Within
// that pool, a product scores higher for:
//   - being in the same category (strongest signal; same-brand-only is weaker)
//   - sharing distinctive words with the current product's name/tags (weighted by
//     rarity across the catalog, so "rechargeable" counts for more than "aid")
//   - being in the same brand
//   - having a similar price
// A rechargeable product leads with other rechargeable products from its own
// category, whatever the brand: someone looking at the Axon C-109 (rechargeable)
// should see the Tulus XB-102 and other rechargeable aids before Axon models that
// take batteries.
// Stock is ignored: a very similar product ranks high even if it is out of stock.
// The one exception is a hand-picked substitute for an out-of-stock product
// (OUT_OF_STOCK_ALTERNATIVES), which always leads.

const GENERIC_BRANDS = new Set(["imported", ""]);
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "pack", "set", "pcs", "piece", "pieces", "new", "best",
  "hot", "deal", "seller", "top", "rated", "premium", "original", "quality", "medical",
  "product", "products", "device", "use", "home", "wellcare", "mart", "size",
]);

// "Rechargeable" / "Rechargable" / "Re-chargeable" in the name or any tag.
function isRechargeable(p: Product): boolean {
  return /re-?charg/i.test([p.name, ...(p.tags ?? [])].join(" "));
}

function brandKey(p: Pick<Product, "brand">): string {
  return (p.brand || "").trim().toLowerCase();
}

function tokensOf(p: Product, brandWords: Set<string>): Set<string> {
  const out = new Set<string>();
  const text = [p.name, ...(p.tags ?? [])].join(" ").toLowerCase();
  for (const raw of text.split(/[^a-z0-9]+/)) {
    if (raw.length < 3) continue;
    if (/\d/.test(raw)) continue; // model codes / sizes (k89, 500ml) never match across products
    if (STOP_WORDS.has(raw) || brandWords.has(raw)) continue;
    out.add(raw);
  }
  return out;
}

export function getRelatedProducts(
  product: Product,
  products: Product[],
  options: { limit?: number; alternativeIds?: string[] } = {},
): Product[] {
  const limit = options.limit ?? 8;
  const others = products.filter((p) => p.id !== product.id);
  const srcBrand = brandKey(product);
  const hasRealBrand = !GENERIC_BRANDS.has(srcBrand);

  // Document frequency over the whole catalog -> rarity weight per word.
  const brandWordsOf = (p: Product) => new Set(brandKey(p).split(/[^a-z0-9]+/).filter(Boolean));
  const tokenCache = new Map<string, Set<string>>();
  const tokens = (p: Product) => {
    let t = tokenCache.get(p.id);
    if (!t) tokenCache.set(p.id, (t = tokensOf(p, brandWordsOf(p))));
    return t;
  };
  const df = new Map<string, number>();
  for (const p of products) for (const w of tokens(p)) df.set(w, (df.get(w) ?? 0) + 1);
  const n = Math.max(products.length, 1);
  const weight = (w: string) => Math.log(1 + n / (df.get(w) ?? 1));

  const srcTokens = tokens(product);
  const srcTotal = [...srcTokens].reduce((sum, w) => sum + weight(w), 0) || 1;

  const srcRechargeable = isRechargeable(product);
  const scored: { p: Product; score: number; i: number; sameCat: boolean; rechargeable: boolean }[] = [];
  others.forEach((p, i) => {
    const sameCat = p.cat === product.cat;
    const sameBrand = hasRealBrand && brandKey(p) === srcBrand;
    if (!sameCat && !sameBrand) return; // never widen the pool

    let score = 0;
    if (sameCat) score += 4;
    if (sameBrand) score += 1.5;

    let shared = 0;
    for (const w of tokens(p)) if (srcTokens.has(w)) shared += weight(w);
    score += 5 * (shared / srcTotal);

    if (product.price > 0 && p.price > 0) {
      const gap = Math.abs(Math.log(p.price / product.price)) / Math.log(3);
      score += 1.5 * Math.max(0, 1 - gap);
    }

    scored.push({ p, score, i, sameCat, rechargeable: srcRechargeable && isRechargeable(p) });
  });

  // Same category is a strict tier: a same-brand product from another category only
  // fills the gaps after every same-category product, however well its words match.
  // Inside it, rechargeable-like-the-source products form their own leading tier.
  scored.sort(
    (a, b) =>
      Number(b.sameCat) - Number(a.sameCat) ||
      Number(b.rechargeable) - Number(a.rechargeable) ||
      b.score - a.score ||
      a.i - b.i,
  );
  const ranked = scored.map((s) => s.p);

  const alt =
    product.stock === "Out of stock"
      ? (options.alternativeIds ?? [])
          .map((id) => others.find((p) => p.id === id))
          .find((p): p is Product => !!p && p.price > 0 && p.stock !== "Out of stock")
      : undefined;
  return (alt ? [alt, ...ranked.filter((p) => p.id !== alt.id)] : ranked).slice(0, limit);
}
