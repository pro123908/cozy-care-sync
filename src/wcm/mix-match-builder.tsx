import { useMemo, useState } from "react";
import {
  MIX_MATCH_MIN_TOTAL,
  MIX_MATCH_TIERS,
  PKR,
  computeBundles,
  getSelectableOptions,
  getUnitPrice,
  isMixMatchProduct,
  type Product,
} from "./data";
import { useWcm } from "./context";
import { useBundlesActive } from "./bundle-clock";
import { Select, type SelectOption } from "./ui";
import { trackBundleClick, trackBundleEvent } from "@/lib/meta-pixel";

type Choice = { p: Product; variant?: string; price: number; group: string };

const prettyCategory = (p: Product) =>
  p.category_name ||
  p.cat
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

// Same trigger look as the checkout city picker.
const selectStyle: React.CSSProperties = {
  padding: "11px 14px",
  borderRadius: 11,
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink)",
  fontSize: 14,
};

/**
 * "Build your own bundle": pick any two products from the mix & match pool.
 * The discount comes from computeBundles (same logic the cart and place-order
 * use), so what's shown here is what the order will get.
 */
export function MixMatchBuilder({
  products,
  isMobile,
  initialFirstId = "",
}: {
  products: Product[];
  isMobile: boolean;
  initialFirstId?: string;
}) {
  const { addToCart } = useWcm();
  const active = useBundlesActive();
  const [aId, setAId] = useState(initialFirstId);
  const [bId, setBId] = useState("");

  const choices = useMemo<Choice[]>(() => {
    const list: Choice[] = [];
    for (const p of products) {
      if (!isMixMatchProduct(p.id)) continue;
      const options = getSelectableOptions(p);
      if (options.length > 1) continue; // "Add both" can't pick an option for the buyer
      const variant = options[0]?.label;
      list.push({ p, variant, price: getUnitPrice(p, variant), group: prettyCategory(p) });
    }
    return list.sort((x, y) => x.group.localeCompare(y.group) || x.p.name.localeCompare(y.p.name));
  }, [products]);

  if (!active || choices.length < 2) return null;

  const a = choices.find((c) => c.p.id === aId);
  const b = choices.find((c) => c.p.id === bId);
  const combined = a && b ? a.price + b.price : 0;
  const off =
    a && b
      ? computeBundles([
          { id: a.p.id, qty: 1, price: a.price },
          { id: b.p.id, qty: 1, price: b.price },
        ]).total
      : 0;

  // Someone is trying to build a bundle: log each product they pick, with the
  // other slot's product too once chosen.
  const trackPick = (pickedId: string, slot: "first" | "second", otherId: string) => {
    const picked = choices.find((c) => c.p.id === pickedId);
    if (!picked) return;
    trackBundleEvent("BundleBuilderPick", {
      productIds: [pickedId, ...(otherId ? [otherId] : [])],
      label: picked.p.name,
      source: "mix & match",
      extra: { slot },
    });
  };

  const optionsFor = (exclude: string): SelectOption[] =>
    choices
      .filter((c) => c.p.id !== exclude)
      .map((c) => ({ value: c.p.id, label: c.p.name, meta: PKR(c.price), image: c.p.image_url || null, group: c.group }));

  const addBoth = () => {
    if (!a || !b) return;
    trackBundleClick({
      productIds: [a.p.id, b.p.id],
      label: `${a.p.name} + ${b.p.name}`,
      source: "mix & match",
      value: combined - off,
    });
    addToCart(a.p, 1, a.variant);
    addToCart(b.p, 1, b.variant);
  };

  return (
    <div
      style={{
        marginBottom: 18,
        padding: isMobile ? 16 : 20,
        borderRadius: 16,
        background: "var(--card)",
        border: "1px solid var(--line)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 17 : 19, fontWeight: 800, color: "var(--ink)" }}>
          Build your own bundle
        </h2>
      </div>
      <p style={{ margin: "6px 0 10px", fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.45 }}>
        Pick any two products and save automatically. The more you spend, the more you save:
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {MIX_MATCH_TIERS.slice()
          .reverse()
          .map((tier) => (
            <div
              key={tier.min}
              style={{
                flex: isMobile ? "1 1 0" : "0 0 auto",
                minWidth: isMobile ? 0 : 112,
                padding: "8px 12px",
                borderRadius: 12,
                background: "var(--pill-success-bg)",
                color: "var(--pill-success-fg)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.85 }}>{PKR(tier.min)}+</div>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>Save {PKR(tier.off)}</div>
            </div>
          ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-4)" }}>First product</span>
          <Select
            full
            searchable
            searchPlaceholder="Search products…"
            emptyLabel="No matching product"
            value={aId}
            placeholder="Choose a product…"
            options={optionsFor(bId)}
            onChange={(id) => {
              setAId(id);
              if (id === bId) setBId("");
              trackPick(id, "first", id === bId ? "" : bId);
            }}
            style={selectStyle}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-4)" }}>Second product</span>
          <Select
            full
            searchable
            searchPlaceholder="Search products…"
            emptyLabel="No matching product"
            value={bId}
            placeholder="Choose a product…"
            options={optionsFor(aId)}
            onChange={(id) => {
              setBId(id);
              trackPick(id, "second", aId);
            }}
            style={selectStyle}
          />
        </div>
      </div>

      {a && b && (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: 18, color: "var(--ink)" }}>{PKR(combined - off)}</span>{" "}
              {off > 0 && (
                <span style={{ fontSize: 13, color: "var(--ink-4)", textDecoration: "line-through" }}>
                  {PKR(combined)}
                </span>
              )}
            </div>
            {off > 0 ? (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pill-success-fg)", marginTop: 2 }}>
                Save {PKR(off)} · 🚚 Free delivery
              </div>
            ) : (
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pill-warn-fg)", marginTop: 2 }}>
                Pick items totalling {PKR(MIX_MATCH_MIN_TOTAL)}+ to unlock a discount (currently {PKR(combined)})
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={addBoth}
            style={{
              border: "none",
              borderRadius: 10,
              background: "var(--grad)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              padding: "10px 22px",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Add both
          </button>
        </div>
      )}
    </div>
  );
}
