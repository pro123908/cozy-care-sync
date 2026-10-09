import { useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useWcm } from "./context";
import { PKR, getDisplayPrice, type Product } from "./data";
import {
  COMPARE_MAX,
  closeCompareModal,
  copyCompareLink,
  setCompareModalView,
  toggleCompare,
  useCompareEntries,
  useCompareModal,
} from "./compare";
import { CompareView } from "./compare-view";
import { Icons } from "./icons";
import { Btn, ProductImage, Stars } from "./ui";
import { useReviewStats } from "./review-stats";

// The Compare popup. Step 1 lists products of the same category to tick (up to 3, the
// product the shopper started from is already ticked); step 2 shows the comparison, all
// without leaving the page.

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        borderRadius: 7,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        background: on ? "var(--pill-teal-fg)" : "var(--card)",
        border: `1.5px solid ${on ? "var(--pill-teal-fg)" : "var(--line)"}`,
      }}
    >
      {on ? Icons.check : null}
    </span>
  );
}

export default function CompareModal() {
  const { view } = useCompareModal();
  const { products, push } = useWcm();
  const entries = useCompareEntries();
  const [query, setQuery] = useState("");
  const reviewStats = useReviewStats();

  // Nothing left to compare (last item unticked or removed, or cleared in another tab): close.
  useEffect(() => {
    if (entries.length === 0) closeCompareModal();
  }, [entries.length]);

  const selected = useMemo(
    () =>
      entries
        .map((e) => products.find((p) => p.id === e.id))
        .filter((p): p is Product => Boolean(p)),
    [entries, products],
  );
  const cat = entries[0]?.cat;
  const categoryName = selected[0]?.category_name || "products";
  const activeView = view === "compare" && selected.length >= 2 ? "compare" : "pick";

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => p.cat === cat && p.price > 0)
      .filter((p) => p.stock !== "Out of stock" || entries.some((e) => e.id === p.id))
      .filter((p) => !q || `${p.name} ${p.brand}`.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          (b.delivered_sales_count ?? 0) - (a.delivered_sales_count ?? 0) ||
          a.name.localeCompare(b.name),
      );
  }, [products, cat, query, entries]);

  const toggle = (p: Product) => {
    const result = toggleCompare(p, "compare popup");
    if (result.refused) push(result.refused, { tone: "amber" });
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && closeCompareModal()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="wcm-cmp-overlay" />
        <DialogPrimitive.Content className="wcm-cmp-content" aria-describedby={undefined}>
          <div className="wcm-cmp-head">
            {activeView === "compare" ? (
              <button
                type="button"
                onClick={() => setCompareModalView("pick")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: 0,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink-3)",
                }}
              >
                {Icons.chevL} Change products
              </button>
            ) : (
              <div style={{ minWidth: 0 }}>
                <DialogPrimitive.Title
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 900,
                    letterSpacing: -0.3,
                    color: "var(--ink)",
                  }}
                >
                  Compare products
                </DialogPrimitive.Title>
                <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginTop: 2 }}>
                  Pick up to {COMPARE_MAX} from {categoryName}
                </div>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {activeView === "compare" && (
                <>
                  <DialogPrimitive.Title className="wcm-cmp-sr">Comparison</DialogPrimitive.Title>
                  <Btn size="sm" variant="outline" onClick={() => copyCompareLink(selected)}>
                    Copy link
                  </Btn>
                </>
              )}
              <DialogPrimitive.Close className="wcm-cmp-close" aria-label="Close compare">
                {Icons.close}
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="wcm-cmp-body">
            {activeView === "compare" ? (
              <CompareView list={selected} source="compare popup" onLeave={closeCompareModal} />
            ) : (
              <>
                {candidates.length > 6 || query ? (
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search these products…"
                    aria-label="Search products to compare"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 14px",
                      marginBottom: 10,
                      borderRadius: 11,
                      border: "1px solid var(--line)",
                      background: "var(--card)",
                      color: "var(--ink)",
                      fontFamily: "inherit",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {candidates.length === 0 && (
                    <div
                      style={{
                        padding: "24px 0",
                        textAlign: "center",
                        fontSize: 13.5,
                        color: "var(--ink-4)",
                      }}
                    >
                      No products match.
                    </div>
                  )}
                  {candidates.map((p) => {
                    const on = entries.some((e) => e.id === p.id);
                    const full = !on && entries.length >= COMPARE_MAX;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggle(p)}
                        aria-pressed={on}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          width: "100%",
                          padding: 10,
                          textAlign: "left",
                          borderRadius: 14,
                          cursor: full ? "not-allowed" : "pointer",
                          opacity: full ? 0.55 : 1,
                          fontFamily: "inherit",
                          color: "var(--ink)",
                          background: on ? "var(--pill-teal-bg)" : "var(--card)",
                          border: `1px solid ${on ? "var(--pill-teal-fg)" : "var(--line)"}`,
                        }}
                      >
                        <Check on={on} />
                        <span
                          style={{ width: 56, flexShrink: 0, borderRadius: 10, overflow: "hidden" }}
                        >
                          <ProductImage product={p} />
                        </span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              fontSize: 14,
                              fontWeight: 800,
                              lineHeight: 1.3,
                            }}
                          >
                            {p.name}
                          </span>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginTop: 3,
                              fontSize: 12.5,
                              color: "var(--ink-4)",
                            }}
                          >
                            <strong style={{ color: "var(--ink)", fontSize: 13.5 }}>
                              {PKR(getDisplayPrice(p))}
                            </strong>
                            {(() => {
                              const stats = reviewStats(p.id);
                              if (!stats) return null;
                              return (
                                <span
                                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                                >
                                  {stats.ratedCount > 0 && (
                                    <>
                                      <Stars value={stats.average} size={12} showNum={false} />
                                      {stats.average.toFixed(1)}
                                    </>
                                  )}
                                  <span>({stats.count})</span>
                                </span>
                              );
                            })()}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {activeView === "pick" && (
            <div className="wcm-cmp-foot">
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-3)" }}>
                {entries.length} of {COMPARE_MAX} selected
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={closeCompareModal}
                  style={{
                    padding: 0,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--ink-4)",
                  }}
                >
                  Clear
                </button>
                <Btn disabled={selected.length < 2} onClick={() => setCompareModalView("compare")}>
                  {selected.length < 2 ? "Pick one more" : `Compare ${selected.length}`}
                </Btn>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
