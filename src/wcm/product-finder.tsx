import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useWcm } from "./context";
import {
  PKR,
  getProductSeoPathSegment,
  getSelectableOptions,
  isOutOfStockBlocked,
  whatsAppChatUrl,
  type Product,
} from "./data";
import { Icons } from "./icons";
import { Btn, ProductImage, Stars } from "./ui";
import { gaEvent } from "@/lib/ga";
import { trackEngagementEvent, trackEngagementEventOnce } from "@/lib/meta-pixel";

// ---------------------------------------------------------------------------
// Decision tree. Each "need" maps to category slugs (products.cat). Needs with
// several distinct product types get one refine question that narrows the
// categories; everything else goes straight to budget. Slugs are the
// storefront Category ids (see context.tsx loadCategories), not DB ids.
// ---------------------------------------------------------------------------

type Choice = { id: string; label: string; hint?: string; cats: string[] };
type Need = Choice & { refine?: { question: string; choices: Choice[] } };

const FINDER_NEEDS: Need[] = [
  {
    id: "sugar",
    label: "Check blood sugar",
    hint: "Glucometers and test strips",
    cats: ["glucometers", "sugar-strips"],
    refine: {
      question: "Meter or strips?",
      choices: [
        {
          id: "meter",
          label: "A glucometer",
          hint: "Meter to test at home",
          cats: ["glucometers"],
        },
        {
          id: "strips",
          label: "Test strips",
          hint: "Refills for a meter you own",
          cats: ["sugar-strips"],
        },
      ],
    },
  },
  {
    id: "bp",
    label: "Monitor blood pressure",
    hint: "Digital and manual apparatus",
    cats: ["bp-digital", "bp-manual"],
    refine: {
      question: "Digital or manual?",
      choices: [
        {
          id: "digital",
          label: "Digital",
          hint: "Automatic, easiest to use",
          cats: ["bp-digital"],
        },
        { id: "manual", label: "Manual", hint: "Needs a stethoscope", cats: ["bp-manual"] },
        { id: "either", label: "Not sure", hint: "Show both", cats: ["bp-digital", "bp-manual"] },
      ],
    },
  },
  { id: "weight", label: "Track weight", hint: "Weight scales", cats: ["weight-scale"] },
  {
    id: "mobility",
    label: "Walk or move easier",
    hint: "Sticks, walkers, wheelchairs, chairs",
    cats: ["patient-sticks", "walkers", "wheelchairs", "camote-chairs", "mobility"],
    refine: {
      question: "What kind of support?",
      choices: [
        {
          id: "walk",
          label: "Walking aid",
          hint: "Sticks and walkers",
          cats: ["patient-sticks", "walkers"],
        },
        { id: "wheelchair", label: "Wheelchair", cats: ["wheelchairs"] },
        {
          id: "chair",
          label: "Chair or seat",
          hint: "Camote and care chairs",
          cats: ["camote-chairs"],
        },
        {
          id: "other-mob",
          label: "Something else",
          hint: "Other mobility aids",
          cats: ["mobility"],
        },
      ],
    },
  },
  {
    id: "pain",
    label: "Ease pain or stiffness",
    hint: "Heat, massage, TENS and supports",
    cats: ["warmth-pain-relief", "heating-pad", "tens-machine", "massagers", "orthobelts-supports"],
    refine: {
      question: "What kind of relief?",
      choices: [
        {
          id: "heat",
          label: "Heat",
          hint: "Heating pads and warmers",
          cats: ["warmth-pain-relief", "heating-pad"],
        },
        { id: "massage", label: "Massage", cats: ["massagers"] },
        { id: "tens", label: "Electrical (TENS)", cats: ["tens-machine"] },
        { id: "support", label: "Belts and supports", cats: ["orthobelts-supports"] },
      ],
    },
  },
  { id: "hearing", label: "Hear better", hint: "Hearing aids", cats: ["hearing-aids"] },
  {
    id: "breathing",
    label: "Breathing support",
    hint: "Nebulizers and steamers",
    cats: ["nebulizer", "steamers"],
  },
  {
    id: "bed",
    label: "Care for a bedridden patient",
    hint: "Air mattresses and suction",
    cats: ["air-mattress", "suction-machine"],
  },
  { id: "baby", label: "Mother and baby", hint: "Breast pumps", cats: ["breast-pump"] },
];

// ---------------------------------------------------------------------------
// Ranking + budget helpers
// ---------------------------------------------------------------------------

const MIN_PRODUCTS_FOR_BUDGET = 6;

/** Best matches first: in stock, then real demand, then rating. */
function rankProducts(list: Product[]): Product[] {
  const inStock = (p: Product) => (p.stock === "Out of stock" ? 0 : 1);
  return [...list].sort(
    (a, b) =>
      inStock(b) - inStock(a) ||
      (b.delivered_sales_count ?? 0) - (a.delivered_sales_count ?? 0) ||
      b.rating - a.rating ||
      b.reviews - a.reviews,
  );
}

function roundNice(n: number): number {
  const step = n >= 10000 ? 1000 : n >= 3000 ? 500 : 100;
  return Math.max(step, Math.round(n / step) * step);
}

type BudgetBand = { id: string; label: string; min: number; max: number };

/** Splits the matching products into up to three bands so no option is empty. */
function budgetBands(list: Product[]): BudgetBand[] {
  if (list.length < MIN_PRODUCTS_FOR_BUDGET) return [];
  const prices = list.map((p) => p.price).sort((a, b) => a - b);
  const lo = roundNice(prices[Math.floor(prices.length / 3)]);
  const hi = roundNice(prices[Math.floor((prices.length * 2) / 3)]);
  if (!(lo < hi)) return [];
  const bands: BudgetBand[] = [
    { id: "low", label: `Under ${PKR(lo)}`, min: 0, max: lo },
    { id: "mid", label: `${PKR(lo)} to ${PKR(hi)}`, min: lo, max: hi },
    { id: "high", label: `${PKR(hi)} and above`, min: hi, max: Infinity },
  ];
  return bands.filter((b) => list.some((p) => p.price >= b.min && p.price < b.max));
}

function pickReasons(top: Product[]): Map<string, string> {
  const reasons = new Map<string, string>();
  if (top.length === 0) return reasons;
  reasons.set(top[0].id, "Best match");
  const rest = top.slice(1);
  const mostOrdered = [...rest].sort(
    (a, b) => (b.delivered_sales_count ?? 0) - (a.delivered_sales_count ?? 0),
  )[0];
  if (mostOrdered && (mostOrdered.delivered_sales_count ?? 0) >= 10)
    reasons.set(mostOrdered.id, "Popular");
  const cheapest = [...top].sort((a, b) => a.price - b.price)[0];
  if (cheapest && !reasons.has(cheapest.id)) reasons.set(cheapest.id, "Lowest price");
  const topRated = [...rest].sort((a, b) => b.rating - a.rating)[0];
  if (topRated && !reasons.has(topRated.id) && topRated.rating >= 4.5)
    reasons.set(topRated.id, "Top rated");
  return reasons;
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

type Step = "need" | "refine" | "budget" | "results";

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 16,
};

function OptionButton({
  label,
  hint,
  onClick,
  selected,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        textAlign: "left",
        padding: "13px 14px",
        borderRadius: 12,
        border: `1px solid ${selected ? "var(--pill-teal-fg)" : "var(--line)"}`,
        background: selected ? "var(--pill-teal-bg)" : "var(--card)",
        color: "var(--ink)",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 800 }}>{label}</span>
        {hint ? (
          <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-4)", marginTop: 2 }}>
            {hint}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        style={{ color: "var(--ink-4)", flexShrink: 0, display: "inline-flex" }}
      >
        {Icons.chev}
      </span>
    </button>
  );
}

function ResultRow({
  product,
  reason,
  products,
  position,
}: {
  product: Product;
  reason?: string;
  products: Product[];
  position: number;
}) {
  const { addToCart } = useWcm();
  const navigate = useNavigate();
  const hasOptions = getSelectableOptions(product).length > 0;
  const blocked = isOutOfStockBlocked(product);
  const open = () => {
    trackEngagementEvent("FinderResultClick", {
      label: product.name,
      source: "finder",
      productIds: [product.id],
      extra: { position: String(position) },
    });
    navigate({
      to: "/products/$productId",
      params: { productId: getProductSeoPathSegment(product, products) },
    });
  };

  return (
    <div style={{ ...card, padding: 12, display: "flex", gap: 12, alignItems: "stretch" }}>
      <button
        type="button"
        onClick={open}
        aria-label={`View ${product.name}`}
        style={{
          width: 88,
          flexShrink: 0,
          padding: 0,
          border: "none",
          background: "none",
          cursor: "pointer",
          borderRadius: 10,
          overflow: "hidden",
          alignSelf: "flex-start",
        }}
      >
        <ProductImage product={product} />
      </button>
      <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {reason ? (
          <span
            style={{
              alignSelf: "flex-start",
              padding: "2px 9px",
              borderRadius: 999,
              background: "var(--pill-teal-bg)",
              color: "var(--pill-teal-fg)",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {reason}
          </span>
        ) : null}
        <button
          type="button"
          onClick={open}
          style={{
            padding: 0,
            border: "none",
            background: "none",
            textAlign: "left",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 800,
            lineHeight: 1.3,
            color: "var(--ink)",
          }}
        >
          {product.name}
        </button>
        {product.reviews > 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--ink-4)",
            }}
          >
            <Stars value={product.rating} size={12} showNum={false} />
            <span>
              {product.rating.toFixed(1)} ({product.reviews})
            </span>
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginTop: "auto",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: "var(--ink)" }}>
              {PKR(product.price)}
            </span>
            {product.was && product.was > product.price ? (
              <span style={{ fontSize: 12, color: "var(--ink-4)", textDecoration: "line-through" }}>
                {PKR(product.was)}
              </span>
            ) : null}
          </div>
          {hasOptions ? (
            <Btn size="sm" variant="outline" onClick={open}>
              Choose option
            </Btn>
          ) : (
            <Btn
              size="sm"
              disabled={blocked}
              onClick={() => {
                addToCart(product);
                gaEvent("finder_add_to_cart", { item_id: product.id });
                trackEngagementEvent("FinderAddToCart", {
                  label: product.name,
                  source: "finder",
                  productIds: [product.id],
                  extra: { position: String(position) },
                });
              }}
            >
              {blocked ? "Out of stock" : "Add to cart"}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProductFinder({
  initialNeed,
  source = "direct",
}: {
  initialNeed?: string;
  /** Where the shopper came from ("home page", "header", ...), for the admin feed. */
  source?: string;
}) {
  const { products, productsLoaded, categories } = useWcm();
  const navigate = useNavigate();

  useEffect(() => {
    trackEngagementEventOnce("finder_start", "FinderStart", {
      label: "Opened the product finder",
      source,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [needId, setNeedId] = useState<string | null>(() =>
    FINDER_NEEDS.some((n) => n.id === initialNeed) ? (initialNeed as string) : null,
  );
  const [refineId, setRefineId] = useState<string | null>(null);
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [budgetSkipped, setBudgetSkipped] = useState(false);

  const need = FINDER_NEEDS.find((n) => n.id === needId) ?? null;
  const refine = need?.refine?.choices.find((c) => c.id === refineId) ?? null;
  const activeCats = refine?.cats ?? need?.cats ?? [];

  const matching = useMemo(
    () =>
      rankProducts(
        products.filter(
          (p) => activeCats.includes(p.cat) && p.price > 0 && !isOutOfStockBlocked(p),
        ),
      ),
    [products, activeCats.join("|")], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const bands = useMemo(() => budgetBands(matching), [matching]);

  const step: Step = !need
    ? "need"
    : need.refine && !refine
      ? "refine"
      : bands.length > 1 && !budgetId && !budgetSkipped
        ? "budget"
        : "results";

  const band = bands.find((b) => b.id === budgetId) ?? null;
  const results = useMemo(() => {
    const filtered = band
      ? matching.filter((p) => p.price >= band.min && p.price < band.max)
      : matching;
    return filtered.slice(0, 3);
  }, [matching, band]);
  const reasons = useMemo(() => pickReasons(results), [results]);

  const resultsKey = step === "results" ? `${needId}|${refineId}|${budgetId}` : "";
  const answersLabel = [need?.label, refine?.label, band?.label].filter(Boolean).join(" · ");

  useEffect(() => {
    // Wait for the catalog so a deep link doesn't log a false "0 picks".
    if (!resultsKey || !productsLoaded) return;
    gaEvent("finder_results", {
      need: needId,
      refine: refineId,
      budget: budgetId,
      result_count: results.length,
    });
    trackEngagementEvent("FinderResults", {
      label: `${answersLabel} → ${results.length} ${results.length === 1 ? "pick" : "picks"}`,
      source: "finder",
      productIds: results.map((p) => p.id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsKey, productsLoaded]);

  const reset = () => {
    setNeedId(null);
    setRefineId(null);
    setBudgetId(null);
    setBudgetSkipped(false);
  };

  const back = () => {
    if (step === "results" && (budgetId || budgetSkipped)) {
      setBudgetId(null);
      setBudgetSkipped(false);
    } else if (step === "results" || step === "budget") {
      if (need?.refine) setRefineId(null);
      else reset();
      setBudgetId(null);
      setBudgetSkipped(false);
    } else if (step === "refine") {
      reset();
    }
  };

  const stepCount = 1 + (need?.refine ? 1 : 0) + (bands.length > 1 ? 1 : 0);
  const stepIndex =
    step === "need" ? 1 : step === "refine" ? 2 : step === "budget" ? stepCount : stepCount;

  const whatsappMessage = [
    "Hi, I need help choosing a product.",
    need ? `Looking for: ${need.label}${refine ? ` (${refine.label})` : ""}.` : "",
    band ? `Budget: ${band.label}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const categorySlug =
    activeCats.length === 1 ? activeCats[0] : need?.refine ? null : activeCats[0];
  const categoryName = categorySlug
    ? categories.find((c) => c.id === categorySlug)?.name
    : undefined;

  return (
    <div style={{ ...card, padding: 18 }}>
      {step !== "results" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          {step !== "need" ? (
            <button
              type="button"
              onClick={back}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--ink-3)",
              }}
            >
              {Icons.chevL} Back
            </button>
          ) : (
            <span />
          )}
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-4)" }}>
            Step {stepIndex}
            {step === "need" ? "" : ` of ${stepCount}`}
          </span>
        </div>
      ) : null}

      {!productsLoaded && step !== "need" ? (
        <div style={{ minHeight: 160 }} aria-hidden="true" />
      ) : null}

      {step === "need" && (
        <>
          <h2
            style={{
              margin: "0 0 12px",
              fontSize: 18,
              fontWeight: 900,
              color: "var(--ink)",
              letterSpacing: -0.3,
            }}
          >
            What do you need help with?
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
              gap: 8,
            }}
          >
            {FINDER_NEEDS.map((n) => (
              <OptionButton
                key={n.id}
                label={n.label}
                hint={n.hint}
                onClick={() => setNeedId(n.id)}
              />
            ))}
          </div>
        </>
      )}

      {step === "refine" && need?.refine && productsLoaded && (
        <>
          <h2
            style={{
              margin: "0 0 12px",
              fontSize: 18,
              fontWeight: 900,
              color: "var(--ink)",
              letterSpacing: -0.3,
            }}
          >
            {need.refine.question}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
              gap: 8,
            }}
          >
            {need.refine.choices.map((c) => (
              <OptionButton
                key={c.id}
                label={c.label}
                hint={c.hint}
                onClick={() => setRefineId(c.id)}
              />
            ))}
          </div>
        </>
      )}

      {step === "budget" && productsLoaded && (
        <>
          <h2
            style={{
              margin: "0 0 12px",
              fontSize: 18,
              fontWeight: 900,
              color: "var(--ink)",
              letterSpacing: -0.3,
            }}
          >
            What's your budget?
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
              gap: 8,
            }}
          >
            {bands.map((b) => (
              <OptionButton key={b.id} label={b.label} onClick={() => setBudgetId(b.id)} />
            ))}
            <OptionButton label="Any budget" onClick={() => setBudgetSkipped(true)} />
          </div>
        </>
      )}

      {step === "results" && productsLoaded && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 900,
                  color: "var(--ink)",
                  letterSpacing: -0.3,
                }}
              >
                {results.length > 0 ? "Our picks for you" : "Nothing matched"}
              </h2>
              <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginTop: 3 }}>
                {need?.label}
                {refine ? ` · ${refine.label}` : ""}
                {band ? ` · ${band.label}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <button
                type="button"
                onClick={back}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink-3)",
                }}
              >
                Change answers
              </button>
              <button
                type="button"
                onClick={reset}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink-3)",
                }}
              >
                Start over
              </button>
            </div>
          </div>

          {results.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {results.map((p, i) => (
                <ResultRow
                  key={p.id}
                  product={p}
                  reason={reasons.get(p.id)}
                  products={products}
                  position={i + 1}
                />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: "var(--ink-3)", padding: "8px 0 4px" }}>
              Try a different budget, or ask us and we'll help you choose.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {categorySlug ? (
              <Btn
                variant="outline"
                onClick={() => {
                  trackEngagementEvent("FinderCategoryClick", {
                    label: categoryName || categorySlug,
                    source: "finder",
                  });
                  navigate({ to: "/categories/$categoryId", params: { categoryId: categorySlug } });
                }}
              >
                See all{categoryName ? ` ${categoryName}` : ""}
              </Btn>
            ) : (
              <Btn variant="outline" onClick={() => navigate({ to: "/" })}>
                Browse all products
              </Btn>
            )}
            <a
              href={whatsAppChatUrl(whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                gaEvent("finder_whatsapp", { need: needId, refine: refineId });
                trackEngagementEvent("FinderWhatsAppClick", {
                  label: answersLabel || "No answers yet",
                  source: "finder",
                });
              }}
              style={{ textDecoration: "none" }}
            >
              <Btn variant="soft" icon={Icons.whatsapp}>
                Ask us on WhatsApp
              </Btn>
            </a>
          </div>
        </>
      )}
    </div>
  );
}

/** Slim entry card for the homepage. */
export function ProductFinderEntry({ isMobile }: { isMobile: boolean }) {
  const navigate = useNavigate();
  return (
    <div
      style={{
        ...card,
        margin: "0 0 14px",
        padding: isMobile ? "14px 16px" : "14px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        flexWrap: isMobile ? "wrap" : "nowrap",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "var(--ink)" }}>
          Not sure what to buy?
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 2 }}>
          Answer a few taps and we'll pick for you.
        </div>
      </div>
      <Btn
        size="sm"
        onClick={() => {
          gaEvent("finder_open", { source: "home" });
          navigate({ to: "/finder", search: { need: undefined, from: "home page" } });
        }}
      >
        Find my product
      </Btn>
    </div>
  );
}
