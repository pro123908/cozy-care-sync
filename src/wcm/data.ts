// Catalog data for Wellcare Mart
export type Product = {
  id: string;
  name: string;
  brand: string;
  cat: string;
  category_name?: string;
  price: number;
  was?: number;
  rating: number;
  reviews: number;
  sales_count?: number;
  delivered_sales_count?: number;
  confirmed_sales_count?: number;
  daraz_delivered_sales_count?: number;
  stock: string;
  tags: string[];
  blurb: string;
  swatch: string;
  image_url?: string | null;
  gallery_images?: string[] | null;
  gallery_videos?: string[] | null;
  size_chart_image?: string | null;
  size_options?: ProductSizeOption[];
  variant_options?: ProductVariantOption[];
};

// Shared "badge" a product gets shown with — curated tags win over the
// automatic "Hot" signal unless a product is already tagged "Best seller",
// in which case that curated label wins instead of showing both. Kept here
// (not duplicated per-component) so the threshold and priority order can't
// silently drift between the product grid and the search suggestions
// dropdown.
//
// "Hot" is based on delivered_sales_count, not sales_count — sales_count
// counts every order ever placed regardless of outcome (including
// cancelled/still-in-transit ones), which overstates real demand; a product
// with lots of cancellations isn't actually "hot".
export const CURATED_TAGS = new Set(["Best seller", "Top rated", "Deal"]);

export function getProductBadge(p: Pick<Product, "tags" | "delivered_sales_count">): { label: string; tone: string } | null {
  const curatedTag = p.tags.find((tag) => CURATED_TAGS.has(tag));
  const label = (p.delivered_sales_count ?? 0) >= 10 && !p.tags.includes("Best seller") ? "🔥 Hot" : curatedTag || "";
  if (!label) return null;
  const tone =
    label === "Best seller" || label === "🔥 Hot" ? "green" : label === "Top rated" ? "blue" : label === "Deal" ? "rose" : "slate";
  return { label, tone };
}

export type ProductSizeOption = {
  size: string;
  price: number;
};

export type ProductVariantOption = {
  name: string;
  price: number;
  image_url?: string | null;
};

export type Category = {
  id: string;
  name: string;
  count: number;
  image_url?: string | null;
  top_category?: boolean;
};

export const CATEGORIES: Category[] = [
  { id: "all", name: "All products", count: 0 },
  { id: "glucometers", name: "Glucometers", count: 0 },
  { id: "bp-digital", name: "BP Digital", count: 0 },
  { id: "bp-manual", name: "BP Manual", count: 0 },
  { id: "weight-scale", name: "Weight Scale", count: 0 },
  { id: "camote-chairs", name: "Camote Chairs", count: 0 },
  { id: "walkers", name: "Imported Walkers", count: 0 },
  { id: "patient-sticks", name: "Patient Sticks", count: 0 },
  { id: "wheelchairs", name: "Wheel Chairs", count: 0 },
  { id: "sugar-strips", name: "Sugar Strips", count: 0 },
  { id: "hearing-aids", name: "Hearing Aids", count: 0 },
  { id: "heating-pad", name: "Heating Pad", count: 0 },
  { id: "air-mattress", name: "Air Mattress", count: 0 },
  { id: "tens-machine", name: "Tens Machine", count: 0 },
  { id: "nebulizer", name: "Nebulizer", count: 0 },
  { id: "stethoscope", name: "Stethoscope", count: 0 },
  { id: "massagers", name: "Massagers", count: 0 },
  { id: "orthobelts-supports", name: "Orthobelts and Supports", count: 0 },
  { id: "breast-pump", name: "Breast Pump", count: 0 },
  { id: "steamers", name: "Steamers", count: 0 },
  { id: "suction-machine", name: "Suction Machine", count: 0 },
  { id: "other", name: "Other Items", count: 0 },
];

export const PKR = (n: number) => "Rs " + n.toLocaleString("en-PK");

export function normalizeSizeOptions(options?: ProductSizeOption[] | null): ProductSizeOption[] {
  if (!Array.isArray(options)) return [];
  const seen = new Set<string>();
  const normalized: ProductSizeOption[] = [];

  for (const option of options) {
    const size = typeof option?.size === "string" ? option.size.trim() : "";
    const price = Number(option?.price);
    const key = size.toLowerCase();
    if (!size || !Number.isFinite(price) || price < 0 || seen.has(key)) continue;
    seen.add(key);
    normalized.push({ size, price: Math.round(price) });
  }

  return normalized;
}

export function normalizeVariantOptions(
  options?: ProductVariantOption[] | null,
): ProductVariantOption[] {
  if (!Array.isArray(options)) return [];
  const seen = new Set<string>();
  const normalized: ProductVariantOption[] = [];

  for (const option of options) {
    const name = typeof option?.name === "string" ? option.name.trim() : "";
    const price = Number(option?.price);
    const key = name.toLowerCase();
    if (!name || !Number.isFinite(price) || price < 0 || seen.has(key)) continue;
    seen.add(key);
    normalized.push({ name, price: Math.round(price), image_url: typeof option?.image_url === "string" ? option.image_url : null });
  }

  return normalized;
}

export function getSelectableOptions(product: Product): Array<{ label: string; price: number; imageUrl: string | null }> {
  const variantOptions = normalizeVariantOptions(product.variant_options);
  if (variantOptions.length > 0) {
    return variantOptions.map((option) => ({ label: option.name, price: option.price, imageUrl: option.image_url ?? null }));
  }

  return normalizeSizeOptions(product.size_options).map((option) => ({
    label: option.size,
    price: option.price,
    imageUrl: null,
  }));
}

export function getUnitPrice(product: Product, selectedSize?: string): number {
  const options = getSelectableOptions(product);
  if (!options.length) return product.price;

  if (selectedSize) {
    const matched = options.find(
      (option) => option.label.toLowerCase() === selectedSize.toLowerCase(),
    );
    if (matched) return matched.price;
  }

  return options[0].price;
}

export function getDisplayPrice(product: Product): number {
  const options = getSelectableOptions(product);
  if (!options.length) return product.price;
  return Math.min(...options.map((option) => option.price));
}

// ---------------------------------------------------------------------------
// Delivery / shipping rules
//
// Free delivery applies at a lower threshold in Karachi, and at a higher
// threshold everywhere else. Below the applicable threshold, the flat
// shipping fee applies. Keep this in sync with the authoritative server-side
// calculation in the place-order edge function
// (supabase/functions/place-order/index.ts), which is what actually charges
// the customer.
// ---------------------------------------------------------------------------

export const FREE_SHIPPING_THRESHOLD = 2000;
// Outside Karachi the Rs 250 fee stays until Rs 5,000 (tried Rs 2,000 on
// 2026-09-21, reverted the same day). Any applied bundle / mix & match pair ships
// free everywhere regardless — see computeShipping's hasBundle.
export const FREE_SHIPPING_THRESHOLD_OTHER_CITIES = 5000;
export const SHIPPING_COST = 250;

// "Order over Rs 5,000 -> Rs 200 off next order" reward, mirrored from
// place-order/index.ts's REWARD_COUPON_THRESHOLD/REWARD_COUPON_DISCOUNT
// (that edge function is what actually issues the coupon — these are only
// for showing the "add Rs X more" nudge client-side). Deliberately separate
// from the free-delivery thresholds (independent business rules).
export const REWARD_COUPON_THRESHOLD = 5000;
export const REWARD_COUPON_DISCOUNT = 200;

// ---------------------------------------------------------------------------
// Bundle deals: buy both products together, get a flat Rs discount. Applied
// automatically in the cart (no code). Mirrored in place-order/index.ts, which
// is the actual authority — keep the two lists identical.
// ---------------------------------------------------------------------------

export type Bundle = { id: string; ids: [string, string]; discount: number };

// Pair complementary/same-brand items only (meter + its strips, manual BP set +
// stethoscope, ...) — never two of the same kind of product.
export const BUNDLES: Bundle[] = [
  { id: "gluco-002+strip-003", ids: ["gluco-002", "strip-003"], discount: 250 },
  { id: "gluco-003+strip-003", ids: ["gluco-003", "strip-003"], discount: 250 },
  { id: "gluco-001+strip-002", ids: ["gluco-001", "strip-002"], discount: 250 },
  { id: "gluco-004+strip-007", ids: ["gluco-004", "strip-007"], discount: 200 },
  { id: "bd-012+neb-010", ids: ["bd-012", "neb-010"], discount: 200 },
  { id: "bd-012+po-002", ids: ["bd-012", "po-002"], discount: 250 },
  { id: "bd-012+wsd-002", ids: ["bd-012", "wsd-002"], discount: 200 },
  { id: "bd-012+oth-018", ids: ["bd-012", "oth-018"], discount: 150 },
  { id: "hear-002+bd-012", ids: ["hear-002", "bd-012"], discount: 250 },
  { id: "ha-007+bd-012", ids: ["ha-007", "bd-012"], discount: 250 },
  { id: "bp-man-003+steth-001", ids: ["bp-man-003", "steth-001"], discount: 150 },
  { id: "bp-man-002+steth-003", ids: ["bp-man-002", "steth-003"], discount: 150 },
  { id: "stick-001+rub-001", ids: ["stick-001", "rub-001"], discount: 100 },
  { id: "mas-012+tens-001", ids: ["mas-012", "tens-001"], discount: 300 },
  { id: "supp-001+oth-002", ids: ["supp-001", "oth-002"], discount: 100 },
];

/** Highest-discount bundle a product belongs to, if any (for card badges). */
export function bestBundleFor(productId: string): Bundle | undefined {
  if (!bundlesActive()) return undefined;
  return BUNDLES.filter((b) => b.ids.includes(productId)).sort((a, b) => b.discount - a.discount)[0];
}

/**
 * Bundle deals run until this instant (Wed 23 Sep 2026, 11:59 PM Pakistan
 * time). After it, computeBundles/bestBundleFor return nothing, so the
 * discount, chips, rails and bundle free-delivery all stop. Mirrored in
 * place-order/index.ts, which also enforces it server-side. To extend the
 * deals, change it in BOTH places and redeploy both.
 */
export const BUNDLE_DEALS_END_MS = new Date("2026-09-23T23:59:59+05:00").getTime();

export function bundlesActive(now: number = Date.now()): boolean {
  return now <= BUNDLE_DEALS_END_MS;
}

// ---------------------------------------------------------------------------
// Mix & match: any TWO different products from this pool, combined price
// >= Rs 2,500, get a tiered discount. Pool = products with a margin >= Rs 400
// (and >= 12%, price <= Rs 8,000, no size/variant choice), excluding
// wheelchairs and commode/shower chairs. Fixed BUNDLES take priority; only
// leftover units are paired. Mirrored in place-order/index.ts (keep the pool,
// tiers and pairing algorithm identical).
// ---------------------------------------------------------------------------

export const MIX_MATCH_MIN_TOTAL = 2500;
export const MIX_MATCH_TIERS = [
  { min: 7000, off: 300 },
  { min: 4000, off: 200 },
  { min: 2500, off: 100 },
];

export const MIX_MATCH_IDS: string[] = [
  "bd-012",
  "bp-dig-002",
  "bp-dig-003",
  "bp-dig-004",
  "bp-dig-005",
  "bp-dig-008",
  "bp-dig-011",
  "bp-man-007",
  "bpump-002",
  "gluco-001",
  "gluco-002",
  "gluco-003",
  "gluco-008",
  "gluco-010",
  "ha-006",
  "ha-007",
  "hear-001",
  "hear-002",
  "hear-003",
  "hear-004",
  "heat-001",
  "heat-002",
  "heat-003",
  "heat-004",
  "mas-006",
  "mas-010",
  "mas-011",
  "mas-012",
  "mas-015",
  "mass-003",
  "mass-004",
  "mass-005",
  "neb-003",
  "neb-010",
  "belt-011",
  "os-021",
  "supp-001",
  "oth-004",
  "oth-008",
  "oth-026",
  "oth-028",
  "ps-006",
  "stick-001",
  "stick-004",
  "po-002",
  "steth-007",
  "ss-014",
  "strip-002",
  "strip-003",
  "strip-004",
  "strip-007",
  "tens-001",
  "tens-002",
  "wlk-001",
  "wsd-002",
  "wsd-004",
  "wsd-005",
  "wsd-008",
  "wsm-001",
  "wsm-002",
  "wsm-003",
];
const MIX_MATCH_SET = new Set(MIX_MATCH_IDS);

export function isMixMatchProduct(id: string): boolean {
  return MIX_MATCH_SET.has(id);
}

/** Discount for two products whose prices add up to `combined`. */
export function mixMatchDiscount(combined: number): number {
  return MIX_MATCH_TIERS.find((tier) => combined >= tier.min)?.off ?? 0;
}

/** Greedy pairing, highest price first, partner must be a different product. */
function pairMixMatch(units: { id: string; price: number }[]) {
  const pool = [...units].sort((a, b) => b.price - a.price || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const pairs: { a: string; b: string; discount: number }[] = [];
  const leftover: { id: string; price: number }[] = [];
  while (pool.length > 0) {
    const unit = pool.shift()!;
    const j = pool.findIndex((other) => other.id !== unit.id && unit.price + other.price >= MIX_MATCH_MIN_TOTAL);
    if (j < 0) {
      leftover.push(unit);
      continue;
    }
    const [partner] = pool.splice(j, 1);
    pairs.push({ a: unit.id, b: partner.id, discount: mixMatchDiscount(unit.price + partner.price) });
  }
  return { pairs, leftover };
}

export type BundleLine = { id: string; qty: number; /** unit price — needed for mix & match */ price?: number };

export type BundleResult = {
  /** Total Rs discount: fixed bundles + mix & match pairs. */
  total: number;
  applied: { bundle: Bundle; times: number }[];
  /** Bundles where the cart has one product but not its partner yet. */
  suggestions: { bundle: Bundle; haveId: string; missingId: string }[];
  /** Mix & match pairs that matched (already included in `total`). */
  mixPairs: { a: string; b: string; discount: number }[];
  /** Eligible mix & match units still without a partner. */
  mixLeftover: { id: string; price: number }[];
};

/**
 * Each bundle consumes one unit of both its products per application, so a
 * product shared by two bundles (the BP monitor) is only discounted once per
 * unit — the bigger discount wins. Sizes/variants are ignored.
 */
export function computeBundles(lines: BundleLine[]): BundleResult {
  if (!bundlesActive()) return { total: 0, applied: [], suggestions: [], mixPairs: [], mixLeftover: [] };
  const remaining = new Map<string, number>();
  for (const l of lines) remaining.set(l.id, (remaining.get(l.id) ?? 0) + Math.max(0, Number(l.qty) || 0));
  const inCart = new Set(lines.filter((l) => l.qty > 0).map((l) => l.id));
  const applied: BundleResult["applied"] = [];
  let total = 0;
  const byDiscount = [...BUNDLES].sort((a, b) => b.discount - a.discount);
  for (const bundle of byDiscount) {
    const times = Math.min(...bundle.ids.map((id) => remaining.get(id) ?? 0));
    if (times <= 0) continue;
    for (const id of bundle.ids) remaining.set(id, (remaining.get(id) ?? 0) - times);
    applied.push({ bundle, times });
    total += bundle.discount * times;
  }
  const suggestions: BundleResult["suggestions"] = [];
  for (const bundle of byDiscount) {
    const [a, b] = bundle.ids;
    const ra = remaining.get(a) ?? 0;
    const rb = remaining.get(b) ?? 0;
    // Only nudge when the partner isn't in the cart at all — a leftover unit
    // (e.g. a thermometer whose BP monitor already went into another bundle)
    // shouldn't prompt "add another BP monitor".
    if (ra > 0 && rb <= 0 && !inCart.has(b)) suggestions.push({ bundle, haveId: a, missingId: b });
    else if (rb > 0 && ra <= 0 && !inCart.has(a)) suggestions.push({ bundle, haveId: b, missingId: a });
  }
  // Mix & match on whatever eligible units the fixed bundles left over.
  const priceOf = new Map<string, number>();
  for (const l of lines) if (l.price != null && !priceOf.has(l.id)) priceOf.set(l.id, l.price);
  const units: { id: string; price: number }[] = [];
  for (const [id, qty] of remaining) {
    const price = priceOf.get(id);
    if (price == null || !isMixMatchProduct(id)) continue;
    for (let i = 0; i < qty; i++) units.push({ id, price });
  }
  const { pairs: mixPairs, leftover: mixLeftover } = pairMixMatch(units);
  for (const pair of mixPairs) total += pair.discount;
  return { total, applied, suggestions, mixPairs, mixLeftover };
}

// Wheelchairs and commode/shower chairs are delivered in Karachi only. Mirrored
// in place-order/index.ts, which rejects such orders for any other city.
export const KARACHI_ONLY_CATEGORIES = ["wheelchairs", "camote-chairs"];

export function isKarachiOnlyProduct(product: { cat?: string | null }): boolean {
  return KARACHI_ONLY_CATEGORIES.includes(product.cat ?? "");
}

/** True when the delivery city is Karachi (case/whitespace-insensitive). */
export function isKarachiCity(city: string | null | undefined): boolean {
  return /karachi/i.test((city ?? "").trim());
}

/** Delivery fee for a given subtotal and destination city (free when a bundle deal applies). */
export function computeShipping(subtotal: number, city?: string | null, hasBundle = false): number {
  if (subtotal <= 0) return 0;
  // Any applied bundle deal ships free, regardless of city or order size.
  if (hasBundle) return 0;
  const threshold = isKarachiCity(city) ? FREE_SHIPPING_THRESHOLD : FREE_SHIPPING_THRESHOLD_OTHER_CITIES;
  if (subtotal >= threshold) return 0;
  return SHIPPING_COST;
}

// ---------------------------------------------------------------------------
// Pakistan cities — used to populate the checkout city autocomplete. This is a
// free-text field, so the list is only a suggestion set (typos still allowed).
// Sorted alphabetically; covers all provinces plus AJK and Gilgit-Baltistan.
// ---------------------------------------------------------------------------

export const PAKISTAN_CITIES: string[] = [
  "Abbottabad", "Ahmedpur East", "Alipur", "Arifwala", "Attock", "Badin",
  "Bahawalnagar", "Bahawalpur", "Bannu", "Battagram", "Bhakkar", "Bhalwal",
  "Bhera", "Bhimber", "Burewala", "Chaman", "Chakwal", "Charsadda",
  "Chichawatni", "Chiniot", "Chishtian", "Dadu", "Daharki", "Dera Ghazi Khan",
  "Dera Ismail Khan", "Daska", "Dinga", "Dipalpur", "Faisalabad", "Fateh Jang",
  "Ghotki", "Gilgit", "Gojra", "Gujar Khan", "Gujranwala", "Gujrat",
  "Hafizabad", "Hangu", "Haripur", "Haroonabad", "Hasilpur", "Haveli Lakha",
  "Hyderabad", "Islamabad", "Jacobabad", "Jampur", "Jamshoro", "Jaranwala",
  "Jhang", "Jhelum", "Kabirwala", "Kamalia", "Kamoke", "Karachi", "Kasur",
  "Khairpur", "Khanewal", "Khanpur", "Kharian", "Khushab", "Khuzdar", "Kohat",
  "Kot Addu", "Kotri", "Lahore", "Lakki Marwat", "Larkana", "Layyah",
  "Lodhran", "Loralai", "Mandi Bahauddin", "Mansehra", "Mardan", "Mastung",
  "Mianwali", "Mingora", "Mirpur", "Mirpur Khas", "Multan", "Muridke",
  "Murree", "Muzaffarabad", "Muzaffargarh", "Narowal", "Nawabshah", "Nowshera",
  "Okara", "Pakpattan", "Peshawar", "Pishin", "Quetta", "Rahim Yar Khan",
  "Rajanpur", "Rawalpindi", "Sadiqabad", "Sahiwal", "Sanghar", "Sargodha",
  "Sheikhupura", "Shikarpur", "Sialkot", "Sibi", "Skardu", "Sukkur", "Swabi",
  "Swat", "Tando Adam", "Tando Allahyar", "Tando Muhammad Khan", "Taxila",
  "Thatta", "Toba Tek Singh", "Turbat", "Vehari", "Wah Cantonment",
  "Wazirabad", "Zhob",
];

function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function getProductSeoPathSegment(product: Product, allProducts?: Product[]): string {
  const nameSlug = slugifySegment(product.name);
  const idSlug = slugifySegment(product.id);
  const baseSlug = nameSlug || idSlug;
  if (!baseSlug) return "product";

  if (!allProducts || allProducts.length === 0) {
    return baseSlug;
  }

  const sameBase = [...allProducts]
    .filter((candidate) => {
      const candidateBase = slugifySegment(candidate.name) || slugifySegment(candidate.id);
      return candidateBase === baseSlug;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  if (sameBase.length <= 1) {
    return baseSlug;
  }

  const index = sameBase.findIndex((candidate) => candidate.id === product.id);
  if (index < 0) {
    return baseSlug;
  }

  if (index === 0) {
    return baseSlug;
  }

  return `${baseSlug}-${index + 1}`;
}

export function resolveProductIdFromParam(
  rawParam: string,
  products: Product[],
): string | undefined {
  const normalized = rawParam.trim().toLowerCase();
  if (!normalized) return undefined;

  const exact = products.find((product) => product.id.toLowerCase() === normalized);
  if (exact) return exact.id;

  const byNameSlug = [...products]
    .sort((a, b) => a.id.localeCompare(b.id))
    .find((product) => normalized === getProductSeoPathSegment(product, products));
  if (byNameSlug) return byNameSlug.id;

  // Backward compatibility for older id-slug and name-id-slug URLs.
  const byLegacyIdSlug = products.find((product) => {
    const idSlug = slugifySegment(product.id);
    if (!idSlug) return false;
    return normalized === idSlug || normalized.endsWith(`-${idSlug}`);
  });

  return byLegacyIdSlug?.id;
}

export const PRODUCTS: Product[] = [
  // Glucometers
  {
    id: "gluco-001",
    name: "Accu Check Active",
    brand: "",
    cat: "glucometers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "gluco-002",
    name: "Accu Check Instant",
    brand: "",
    cat: "glucometers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "gluco-003",
    name: "Accu Check Instant S",
    brand: "",
    cat: "glucometers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "gluco-004",
    name: "Evo Check Go",
    brand: "",
    cat: "glucometers",
    price: 1700,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "gluco-005",
    name: "On Call",
    brand: "",
    cat: "glucometers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "gluco-006",
    name: "On Call Extra",
    brand: "",
    cat: "glucometers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "gluco-007",
    name: "Atom",
    brand: "",
    cat: "glucometers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "gluco-008",
    name: "Master",
    brand: "",
    cat: "glucometers",
    price: 700,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "gluco-009",
    name: "Medisign",
    brand: "",
    cat: "glucometers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "gluco-010",
    name: "Evo Check",
    brand: "",
    cat: "glucometers",
    price: 3400,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "gluco-011",
    name: "Life Check",
    brand: "",
    cat: "glucometers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  // BP Digital
  {
    id: "bp-dig-001",
    name: "Omron M1",
    brand: "",
    cat: "bp-digital",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-dig-002",
    name: "Medisign 804",
    brand: "",
    cat: "bp-digital",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-dig-003",
    name: "Medisign 830",
    brand: "",
    cat: "bp-digital",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-dig-004",
    name: "Medisign BPM 36",
    brand: "",
    cat: "bp-digital",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-dig-005",
    name: "Medicare 631A",
    brand: "",
    cat: "bp-digital",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-dig-006",
    name: "Medicare 814",
    brand: "",
    cat: "bp-digital",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-dig-007",
    name: "Atom 704",
    brand: "",
    cat: "bp-digital",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-dig-008",
    name: "Ucheck 8008",
    brand: "",
    cat: "bp-digital",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-dig-009",
    name: "Certeza BP 450",
    brand: "",
    cat: "bp-digital",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-dig-010",
    name: "ABM BP Monitor",
    brand: "",
    cat: "bp-digital",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-dig-011",
    name: "Life Check 6250",
    brand: "",
    cat: "bp-digital",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  // BP Manual
  {
    id: "bp-man-001",
    name: "Yuwell",
    brand: "",
    cat: "bp-manual",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-man-002",
    name: "Atom",
    brand: "",
    cat: "bp-manual",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-man-003",
    name: "Medisign",
    brand: "",
    cat: "bp-manual",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-man-004",
    name: "Certeza",
    brand: "",
    cat: "bp-manual",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-man-005",
    name: "ABM",
    brand: "",
    cat: "bp-manual",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-man-006",
    name: "Senior",
    brand: "",
    cat: "bp-manual",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-man-007",
    name: "Master",
    brand: "",
    cat: "bp-manual",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "bp-man-008",
    name: "Certeza Aneroid Blue",
    brand: "",
    cat: "bp-manual",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  // Weight Scale Digital
  {
    id: "wsd-001",
    name: "Camry",
    brand: "",
    cat: "weight-scale",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wsd-002",
    name: "Life Care",
    brand: "",
    cat: "weight-scale",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wsd-003",
    name: "Kitchen Scale",
    brand: "",
    cat: "weight-scale",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wsd-004",
    name: "Evo Check",
    brand: "",
    cat: "weight-scale",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wsd-005",
    name: "Certeza",
    brand: "",
    cat: "weight-scale",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wsd-006",
    name: "Blevia",
    brand: "",
    cat: "weight-scale",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wsd-007",
    name: "Baby Weight Scale",
    brand: "",
    cat: "weight-scale",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wsd-008",
    name: "Senior",
    brand: "",
    cat: "weight-scale",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  // Weight Scale Manual
  {
    id: "wsm-001",
    name: "Camry",
    brand: "",
    cat: "weight-scale",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wsm-002",
    name: "Life Care",
    brand: "",
    cat: "weight-scale",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wsm-003",
    name: "Evo Check",
    brand: "",
    cat: "weight-scale",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wsm-004",
    name: "Certeza",
    brand: "",
    cat: "weight-scale",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wsm-005",
    name: "Blevia",
    brand: "",
    cat: "weight-scale",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wsm-006",
    name: "Senior",
    brand: "",
    cat: "weight-scale",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  // Imported Camote Chairs
  {
    id: "cc-001",
    name: "Secure Camote Chair",
    brand: "",
    cat: "camote-chairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "cc-002",
    name: "Life Care Camote Chair",
    brand: "",
    cat: "camote-chairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "cc-003",
    name: "Secure Camote Chair Wheel",
    brand: "",
    cat: "camote-chairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "cc-004",
    name: "Life Care Camote Chair Wheel",
    brand: "",
    cat: "camote-chairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "cc-005",
    name: "Secure Shower Chair",
    brand: "",
    cat: "camote-chairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "cc-006",
    name: "Life Care Shower Chair",
    brand: "",
    cat: "camote-chairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "cc-007",
    name: "Secure Shower Chair Wheel",
    brand: "",
    cat: "camote-chairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "cc-008",
    name: "Life Care Shower Chair Wheel",
    brand: "",
    cat: "camote-chairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "cc-009",
    name: "Secure Camote Raiser",
    brand: "",
    cat: "camote-chairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "cc-010",
    name: "Life Care Camote Raiser",
    brand: "",
    cat: "camote-chairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  // Imported Walkers
  {
    id: "wlk-001",
    name: "Secure Walker Plain",
    brand: "",
    cat: "walkers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "wlk-002",
    name: "Life Care Walker Plain",
    brand: "",
    cat: "walkers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "wlk-003",
    name: "Secure Walker Wheel",
    brand: "",
    cat: "walkers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "wlk-004",
    name: "Life Care Walker Wheel",
    brand: "",
    cat: "walkers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "wlk-005",
    name: "Rollator",
    brand: "",
    cat: "walkers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  // Patient Sticks
  {
    id: "stick-001",
    name: "Tripod Stick",
    brand: "",
    cat: "patient-sticks",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "stick-002",
    name: "Elbow Stick",
    brand: "",
    cat: "patient-sticks",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "stick-003",
    name: "Trusty Cane Stick Foldable",
    brand: "",
    cat: "patient-sticks",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "stick-004",
    name: "Besaki",
    brand: "",
    cat: "patient-sticks",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  // Wheel Chairs
  {
    id: "wc-001",
    name: "Wheel Chair 809 (Secure & Life Care)",
    brand: "",
    cat: "wheelchairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wc-002",
    name: "Wheel Chair BMW (Secure & Life Care)",
    brand: "",
    cat: "wheelchairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wc-003",
    name: "Wheel Chair 868 (Secure & Life Care)",
    brand: "",
    cat: "wheelchairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wc-004",
    name: "Wheel Chair Aclined (Secure & Life Care)",
    brand: "",
    cat: "wheelchairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "wc-005",
    name: "Electric Wheel Chair (Secure & Life Care)",
    brand: "",
    cat: "wheelchairs",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  // Sugar Strips
  {
    id: "strip-001",
    name: "Atom",
    brand: "",
    cat: "sugar-strips",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "strip-002",
    name: "Accu Check Active",
    brand: "",
    cat: "sugar-strips",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "strip-003",
    name: "Accu Check Instant",
    brand: "",
    cat: "sugar-strips",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "strip-004",
    name: "Free Style",
    brand: "",
    cat: "sugar-strips",
    price: 2100,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "strip-005",
    name: "Ucheck",
    brand: "",
    cat: "sugar-strips",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "strip-006",
    name: "Master",
    brand: "",
    cat: "sugar-strips",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "strip-007",
    name: "Evo Check Go",
    brand: "",
    cat: "sugar-strips",
    price: 1800,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "strip-008",
    name: "Medisign",
    brand: "",
    cat: "sugar-strips",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "strip-009",
    name: "Accu Check Performa",
    brand: "",
    cat: "sugar-strips",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "strip-010",
    name: "Oncall",
    brand: "",
    cat: "sugar-strips",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  // Hearing Aids
  {
    id: "hear-001",
    name: "Axon V 163",
    brand: "",
    cat: "hearing-aids",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "hear-002",
    name: "Axon K 86",
    brand: "",
    cat: "hearing-aids",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  // Heating Pad
  {
    id: "heat-001",
    name: "Atom",
    brand: "",
    cat: "heating-pad",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "heat-002",
    name: "Ucheck",
    brand: "",
    cat: "heating-pad",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "heat-003",
    name: "Medicare",
    brand: "",
    cat: "heating-pad",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "heat-004",
    name: "ABM",
    brand: "",
    cat: "heating-pad",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "heat-005",
    name: "Certeza",
    brand: "",
    cat: "heating-pad",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "heat-006",
    name: "Accu Max",
    brand: "",
    cat: "heating-pad",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "heat-007",
    name: "Life Care",
    brand: "",
    cat: "heating-pad",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  // Air Mattress
  {
    id: "am-001",
    name: "Atom",
    brand: "",
    cat: "air-mattress",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "am-002",
    name: "Ucheck",
    brand: "",
    cat: "air-mattress",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "am-003",
    name: "Medicare",
    brand: "",
    cat: "air-mattress",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "am-004",
    name: "Certeza",
    brand: "",
    cat: "air-mattress",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "am-005",
    name: "Accu Max",
    brand: "",
    cat: "air-mattress",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "am-006",
    name: "Life Care",
    brand: "",
    cat: "air-mattress",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  // Tens Machine
  {
    id: "tens-001",
    name: "Blue Idea Tens 610",
    brand: "",
    cat: "tens-machine",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "tens-002",
    name: "Electronic Plus Tens",
    brand: "",
    cat: "tens-machine",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "tens-003",
    name: "Basemed Tens 660",
    brand: "",
    cat: "tens-machine",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "tens-004",
    name: "Senior Tens 92660",
    brand: "",
    cat: "tens-machine",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "tens-005",
    name: "Blue Idea Tens 2008b",
    brand: "",
    cat: "tens-machine",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  {
    id: "tens-006",
    name: "Life Care Combo Stim EMS",
    brand: "",
    cat: "tens-machine",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "emerald",
  },
  // Nebulizer
  {
    id: "neb-001",
    name: "Ucheck",
    brand: "",
    cat: "nebulizer",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "neb-002",
    name: "Life Care",
    brand: "",
    cat: "nebulizer",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "neb-003",
    name: "Medicare",
    brand: "",
    cat: "nebulizer",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "neb-004",
    name: "Medicare Plus",
    brand: "",
    cat: "nebulizer",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "neb-005",
    name: "Active",
    brand: "",
    cat: "nebulizer",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "neb-006",
    name: "Apple Neb",
    brand: "",
    cat: "nebulizer",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "neb-007",
    name: "Strong Neb",
    brand: "",
    cat: "nebulizer",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "neb-008",
    name: "Micelflux",
    brand: "",
    cat: "nebulizer",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "neb-009",
    name: "Baby Neb",
    brand: "",
    cat: "nebulizer",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "neb-010",
    name: "Mesh Portable Nebulizer",
    brand: "",
    cat: "nebulizer",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "neb-011",
    name: "Atom",
    brand: "",
    cat: "nebulizer",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  // Stethoscope
  {
    id: "steth-001",
    name: "Littmann Classic",
    brand: "",
    cat: "stethoscope",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "steth-002",
    name: "Certeza",
    brand: "",
    cat: "stethoscope",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "steth-003",
    name: "Atom",
    brand: "",
    cat: "stethoscope",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "steth-004",
    name: "Ucheck",
    brand: "",
    cat: "stethoscope",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "steth-005",
    name: "Senior",
    brand: "",
    cat: "stethoscope",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "steth-006",
    name: "Medico",
    brand: "",
    cat: "stethoscope",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "steth-007",
    name: "Life Care",
    brand: "",
    cat: "stethoscope",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "steth-008",
    name: "Medicare",
    brand: "",
    cat: "stethoscope",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "steth-009",
    name: "Blevia",
    brand: "",
    cat: "stethoscope",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "steth-010",
    name: "Yuwell",
    brand: "",
    cat: "stethoscope",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "steth-011",
    name: "Medi Plus",
    brand: "",
    cat: "stethoscope",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  // Massagers
  {
    id: "mass-001",
    name: "Gun Massager",
    brand: "",
    cat: "massagers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "mass-002",
    name: "Magic Massager",
    brand: "",
    cat: "massagers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "mass-003",
    name: "Tikon Massager",
    brand: "",
    cat: "massagers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "mass-004",
    name: "Heated Massager",
    brand: "",
    cat: "massagers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  {
    id: "mass-005",
    name: "Double Head Massager",
    brand: "",
    cat: "massagers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "amber",
  },
  // Ortho Belts
  {
    id: "belt-001",
    name: "Sacro Belt",
    brand: "",
    cat: "ortho-belts",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "belt-002",
    name: "Sacral Belt",
    brand: "",
    cat: "ortho-belts",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "belt-003",
    name: "Abdominal Belt",
    brand: "",
    cat: "ortho-belts",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "belt-004",
    name: "Polysling",
    brand: "",
    cat: "ortho-belts",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "belt-005",
    name: "Soft & Hard Coolers",
    brand: "",
    cat: "ortho-belts",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "belt-006",
    name: "Pregnancy Belt",
    brand: "",
    cat: "ortho-belts",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "belt-007",
    name: "Shoulder Belt",
    brand: "",
    cat: "ortho-belts",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "belt-008",
    name: "Tummy Trimmer Belt",
    brand: "",
    cat: "ortho-belts",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "belt-009",
    name: "Snorkling",
    brand: "",
    cat: "ortho-belts",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "belt-010",
    name: "Posture Belt",
    brand: "",
    cat: "ortho-belts",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  // Supports
  {
    id: "supp-001",
    name: "Knee Support",
    brand: "",
    cat: "supports",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "supp-002",
    name: "Knee Gel Support",
    brand: "",
    cat: "supports",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "supp-003",
    name: "Imported Knee Support",
    brand: "",
    cat: "supports",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "supp-004",
    name: "Ankle Support",
    brand: "",
    cat: "supports",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "supp-005",
    name: "Wrist Brace",
    brand: "",
    cat: "supports",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  // Breast Pump
  {
    id: "bpump-001",
    name: "Life Care Breast Pump",
    brand: "",
    cat: "breast-pump",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "bpump-002",
    name: "Medicare Breast Pump",
    brand: "",
    cat: "breast-pump",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  {
    id: "bpump-003",
    name: "Chaina Breast Pump",
    brand: "",
    cat: "breast-pump",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "rose",
  },
  // Steamers
  {
    id: "steam-001",
    name: "Karliz Steamer",
    brand: "",
    cat: "steamers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "steam-002",
    name: "SC Steamer",
    brand: "",
    cat: "steamers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "steam-003",
    name: "Jaf Steamer",
    brand: "",
    cat: "steamers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "steam-004",
    name: "3 in 1 Steamer",
    brand: "",
    cat: "steamers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "steam-005",
    name: "4 in 1 Steamer",
    brand: "",
    cat: "steamers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  {
    id: "steam-006",
    name: "Life Care Steamer",
    brand: "",
    cat: "steamers",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "sky",
  },
  // Suction Machine
  {
    id: "suct-001",
    name: "Yuwell",
    brand: "",
    cat: "suction-machine",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "suct-002",
    name: "Life Care",
    brand: "",
    cat: "suction-machine",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "suct-003",
    name: "Blevia",
    brand: "",
    cat: "suction-machine",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "suct-004",
    name: "Easy Care",
    brand: "",
    cat: "suction-machine",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  // Other Items
  {
    id: "oth-001",
    name: "Gym Balls",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-002",
    name: "Hot & Cold Gel",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-003",
    name: "Hot Water Bottle",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-004",
    name: "Thermometer Manual Digital",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-005",
    name: "Infrared Thermometer",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-006",
    name: "Adult Diapers",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-007",
    name: "Gloves",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-008",
    name: "Norvus Slime",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-009",
    name: "Drip Set",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-010",
    name: "Canula",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-011",
    name: "BP Cuffs",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-012",
    name: "Bandages",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-013",
    name: "Torch",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-014",
    name: "Food Table",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-015",
    name: "First Aid Box",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-016",
    name: "Masks",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-017",
    name: "Insole Ped",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-018",
    name: "Pulse Oximeter",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-019",
    name: "Drip Stand",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-020",
    name: "Urine Bag",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
  {
    id: "oth-021",
    name: "Urine Bottles",
    brand: "",
    cat: "other",
    price: 0,
    rating: 0,
    reviews: 0,
    stock: "In stock",
    tags: [],
    blurb: "",
    swatch: "slate",
  },
];

CATEGORIES.forEach((c) => {
  c.count = c.id === "all" ? PRODUCTS.length : PRODUCTS.filter((p) => p.cat === c.id).length;
});

export type OrderItem = { id: string; qty: number; size?: string; unit_price?: number };
export type OrderReview = { rating: number; comment: string };
export type Order = {
  id: string;
  placed: string;
  eta: string;
  status: string;
  progress: number;
  address: string;
  city?: string;
  landmark?: string;
  customerName?: string;
  payment: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  // Set when this order was created to replace item(s) from an earlier
  // order (a faulty-product swap). replacementBalanceDue is what the
  // customer actually still owes beyond what they already paid on that
  // original order — `total` alone overstates it, since it's the full
  // value of this new order, not the incremental amount.
  replacesOrderId?: string | null;
  replacementBalanceDue?: number | null;
  rider?: { name: string; phone: string };
  product_reviews?: Record<string, OrderReview>;
  review?: OrderReview;
  courier?: {
    trackingNumber: string;
    status: string;
    statusHistory?: Array<{ status: string; statusWithCity: string; at: string }> | null;
    provider: string;
  } | null;
};
