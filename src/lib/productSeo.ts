// Product-page SEO title. Shared by middleware.ts (what bots/crawlers get) and the
// route's head() so the two can't drift.
//
// A short category descriptor ("Blood Glucose Meter") is appended to a product's
// name only when it adds something: never the old catch-all "Medical Product", and
// never when the name already says it ("Medisign 830 Digital Rechargeable Blood
// Pressure Monitor" + "Digital Blood Pressure Monitor" used to read the same words
// twice). Titles that would run past ~65 characters drop the descriptor too.

const SITE_NAME = "Wellcare Mart";
const MAX_TITLE_LENGTH = 65;

const CATEGORY_DESCRIPTORS: Record<string, string> = {
  glucometers: "Blood Glucose Meter",
  "bp-digital": "Digital Blood Pressure Monitor",
  "bp-manual": "Manual BP Apparatus",
  "weight-scale": "Weight Scale",
  nebulizer: "Nebulizer",
  "orthobelts-supports": "Orthobelt",
};

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** The category descriptor to append, or "" when there is none or the name already covers it. */
export function getSeoDescriptor(name: string, cat?: string | null): string {
  const descriptor = cat ? CATEGORY_DESCRIPTORS[cat] : undefined;
  if (!descriptor) return "";
  const nameWords = new Set(words(name));
  const descriptorWords = words(descriptor);
  const covered = descriptorWords.filter((w) => nameWords.has(w)).length;
  return covered / descriptorWords.length >= 0.5 ? "" : descriptor;
}

export function buildProductSeoTitle(name: string, cat?: string | null): string {
  const descriptor = getSeoDescriptor(name, cat);
  const withDescriptor = `${name} ${descriptor}`.trim();
  const full = `${withDescriptor} — ${SITE_NAME}`;
  return descriptor && full.length > MAX_TITLE_LENGTH ? `${name} — ${SITE_NAME}` : full;
}

// ---------------------------------------------------------------------------
// Meta descriptions. Google shows roughly the first 155 characters, so a long
// product blurb is cut at the end of a sentence (or a word) instead of being
// stuffed into <meta name="description"> whole. The full blurb stays on the page.

const META_DESCRIPTION_MAX = 155;

export function buildMetaDescription(text: string, max = META_DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;

  // Prefer ending on a whole sentence when that still uses most of the budget.
  const head = clean.slice(0, max + 1);
  const sentenceEnd = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  if (sentenceEnd >= max * 0.6) return clean.slice(0, sentenceEnd + 1);

  // Otherwise cut at a word boundary and mark the cut.
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(/[\s,;:–—-]+$/, "")}…`;
}

// ---------------------------------------------------------------------------
// Category pages.

export function buildCategorySeoTitle(name: string): string {
  const long = `${name} Online in Pakistan — ${SITE_NAME}`;
  return long.length <= MAX_TITLE_LENGTH ? long : `${name} — ${SITE_NAME}`;
}

const GENERIC_BRANDS = new Set(["", "imported"]);

export function buildCategoryDescription(
  name: string,
  items: { price: number; brand?: string | null }[],
): string {
  const priced = items.filter((p) => p.price > 0);
  if (priced.length === 0) {
    return `Shop ${name} at ${SITE_NAME}. Cash on delivery across Pakistan, 3-day returns.`;
  }
  const lowest = Math.min(...priced.map((p) => p.price));
  const counts = new Map<string, number>();
  for (const p of priced) {
    const brand = (p.brand ?? "").trim();
    if (!GENERIC_BRANDS.has(brand.toLowerCase())) counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  const brands = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b]) => b);
  const noun = priced.length === 1 ? "product" : "products";
  const brandPart = brands.length ? ` Brands: ${brands.join(", ")}.` : "";
  return buildMetaDescription(
    `Shop ${priced.length} ${name} ${noun} online in Pakistan, from Rs ${lowest.toLocaleString("en-PK")}.${brandPart} Cash on delivery, 3-day returns.`,
  );
}
