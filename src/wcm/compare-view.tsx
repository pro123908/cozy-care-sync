import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useWcm } from "./context";
import {
  PKR,
  getDisplayPrice,
  getProductSeoPathSegment,
  getSelectableOptions,
  isOutOfStockBlocked,
  type Product,
} from "./data";
import { compareRemove } from "./compare";
import { describeReviews, useReviewStats } from "./review-stats";
import { Btn, ProductImage, Stars } from "./ui";
import { useIsMobile } from "@/hooks/use-mobile";
import { trackEngagementEvent } from "@/lib/meta-pixel";

// The comparison itself (a table on desktop, stacked equal columns on phones). Shown in
// the Compare popup and on the shareable /compare page.

const LABEL_W = 104;
const COL_MIN = 170;

const th: React.CSSProperties = {
  textAlign: "left",
  verticalAlign: "top",
  padding: "12px 12px",
  borderBottom: "1px solid var(--line)",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--ink-4)",
  background: "var(--card)",
  position: "sticky",
  left: 0,
  zIndex: 2,
  width: LABEL_W,
  minWidth: LABEL_W,
};
const td: React.CSSProperties = {
  textAlign: "left",
  verticalAlign: "top",
  padding: "12px 12px",
  borderBottom: "1px solid var(--line)",
  fontSize: 13.5,
  color: "var(--ink-2)",
  minWidth: COL_MIN,
};

function Tag({ children, stacked }: { children: React.ReactNode; stacked?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        marginLeft: stacked ? 0 : 6,
        marginTop: stacked ? 4 : 0,
        padding: "1px 8px",
        borderRadius: 999,
        background: "var(--pill-success-bg)",
        color: "var(--pill-success-fg)",
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function CompareView({
  list,
  source,
  onLeave,
}: {
  list: Product[];
  source: string;
  /** Called before leaving for a product page or adding to the cart, so a popup can close first. */
  onLeave?: () => void;
}) {
  const { products, addToCart } = useWcm();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const reviewStats = useReviewStats();

  const viewKey = list.map((p) => p.id).join(",");
  useEffect(() => {
    if (list.length < 2) return;
    trackEngagementEvent("CompareView", {
      label: list.map((p) => p.name).join(" vs "),
      source,
      productIds: list.map((p) => p.id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  const prices = list.map((p) => getDisplayPrice(p));
  const lowest = Math.min(...prices);
  const priceDiffers = new Set(prices).size > 1;
  // "Top rated" needs a real basis: at least 3 star ratings, and a clear winner.
  const solid = list
    .map((p) => ({ id: p.id, stats: reviewStats(p.id) }))
    .filter((x) => x.stats && x.stats.ratedCount >= 3);
  const topAverage = solid.length > 0 ? Math.max(...solid.map((x) => x.stats!.average)) : 0;
  const topRatedIds = new Set(
    solid.length > 1 && new Set(solid.map((x) => x.stats!.average.toFixed(1))).size > 1
      ? solid.filter((x) => x.stats!.average === topAverage).map((x) => x.id)
      : [],
  );

  const openProduct = (p: Product) => {
    onLeave?.();
    navigate({
      to: "/products/$productId",
      params: { productId: getProductSeoPathSegment(p, products) },
    });
  };

  const rows: { label: string; cell: (p: Product) => React.ReactNode }[] = [
    {
      label: "Price",
      cell: (p) => {
        const price = getDisplayPrice(p);
        const hasOptions = getSelectableOptions(p).length > 0;
        return (
          <div>
            <span style={{ fontSize: isMobile ? 15 : 16, fontWeight: 900, color: "var(--ink)" }}>
              {hasOptions ? "From " : ""}
              {PKR(price)}
            </span>
            {priceDiffers && price === lowest && (
              <div>
                <Tag stacked={isMobile}>Lowest</Tag>
              </div>
            )}
            {p.was && p.was > price && !hasOptions && (
              <div style={{ fontSize: 12, color: "var(--ink-4)", textDecoration: "line-through" }}>
                {PKR(p.was)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      label: "Rating",
      cell: (p) => {
        const stats = reviewStats(p.id);
        if (!stats) return <span style={{ color: "var(--ink-4)" }}>No reviews yet</span>;
        return (
          <div>
            {stats.ratedCount > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Stars value={stats.average} size={13} showNum={false} />
                <strong>{stats.average.toFixed(1)}</strong>
              </span>
            )}
            {topRatedIds.has(p.id) && (
              <div>
                <Tag stacked>Top rated</Tag>
              </div>
            )}
            <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{describeReviews(stats)}</div>
          </div>
        );
      },
    },
    {
      label: "Brand",
      cell: (p) => <span style={{ textTransform: "capitalize" }}>{p.brand || "-"}</span>,
    },
    {
      label: "Availability",
      cell: (p) =>
        p.stock === "Out of stock" ? (
          <span style={{ color: "var(--pill-rose-fg)", fontWeight: 700 }}>Out of stock</span>
        ) : (
          <span style={{ color: "var(--pill-success-fg)", fontWeight: 700 }}>In stock</span>
        ),
    },
    {
      label: "Sold",
      cell: (p) => {
        const sold = (p.confirmed_sales_count ?? 0) + (p.daraz_delivered_sales_count ?? 0);
        return sold > 0 ? `${sold}+ sold` : <span style={{ color: "var(--ink-4)" }}>-</span>;
      },
    },
    {
      label: "Options",
      cell: (p) => {
        const options = getSelectableOptions(p);
        return options.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {options.map((o) => (
              <div key={o.label}>
                {o.label} <span style={{ color: "var(--ink-4)" }}>· {PKR(o.price)}</span>
              </div>
            ))}
          </div>
        ) : (
          <span style={{ color: "var(--ink-4)" }}>-</span>
        );
      },
    },
    {
      label: "Key features",
      cell: (p) => {
        const features = (p.features ?? []).filter(Boolean);
        return features.length > 0 ? (
          <ul
            style={{
              margin: 0,
              paddingLeft: isMobile ? 14 : 16,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : (
          <span style={{ color: "var(--ink-3)" }}>{p.blurb || "-"}</span>
        );
      },
    },
  ];

  const addButton = (p: Product, full: boolean) =>
    getSelectableOptions(p).length > 0 ? (
      <Btn size="sm" full={full} variant="outline" onClick={() => openProduct(p)}>
        Choose option
      </Btn>
    ) : (
      <Btn
        size="sm"
        full={full}
        disabled={isOutOfStockBlocked(p)}
        onClick={() => {
          trackEngagementEvent("CompareAddToCart", {
            label: p.name,
            source,
            productIds: [p.id],
          });
          onLeave?.();
          addToCart(p);
        }}
      >
        {isOutOfStockBlocked(p) ? "Out of stock" : "Add to cart"}
      </Btn>
    );

  const removeButton = (p: Product) => (
    <button
      type="button"
      onClick={() => compareRemove(p.id)}
      aria-label={`Remove ${p.name}`}
      style={{
        position: "absolute",
        top: 6,
        right: 6,
        width: 24,
        height: 24,
        borderRadius: 99,
        border: "1px solid var(--line)",
        background: "var(--card)",
        color: "var(--ink-3)",
        cursor: "pointer",
        zIndex: 3,
      }}
    >
      ×
    </button>
  );

  if (isMobile) {
    // Equal columns that fit the screen at normal text size. Under larger text they keep a
    // minimum width (so words don't break mid-word) and the block scrolls sideways.
    const MIN_COL = 104;
    const cols: React.CSSProperties = {
      display: "grid",
      gridTemplateColumns: `repeat(${list.length}, minmax(${MIN_COL}px, 1fr))`,
      gap: 10,
    };
    const innerMin = list.length * MIN_COL + (list.length - 1) * 10 + 24;
    return (
      <div>
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            overflowX: "auto",
          }}
        >
          <div style={{ minWidth: innerMin }}>
            <div style={{ ...cols, padding: 12, borderBottom: "1px solid var(--line)" }}>
              {list.map((p) => (
                <div
                  key={p.id}
                  style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => openProduct(p)}
                      aria-label={`View ${p.name}`}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: 0,
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        borderRadius: 10,
                        overflow: "hidden",
                      }}
                    >
                      <ProductImage product={p} />
                    </button>
                    {removeButton(p)}
                  </div>
                  <button
                    type="button"
                    onClick={() => openProduct(p)}
                    style={{
                      padding: 0,
                      border: "none",
                      background: "none",
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: 800,
                      lineHeight: 1.3,
                      color: "var(--ink)",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {p.name}
                  </button>
                  {addButton(p, true)}
                </div>
              ))}
            </div>
            {rows.map((r, i) => (
              <div
                key={r.label}
                style={{
                  padding: "10px 12px 12px",
                  borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <div
                  style={{
                    position: "sticky",
                    left: 12,
                    width: "max-content",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--ink-4)",
                    marginBottom: 6,
                  }}
                >
                  {r.label}
                </div>
                <div
                  style={{
                    ...cols,
                    fontSize: 12.5,
                    color: "var(--ink-2)",
                    lineHeight: 1.4,
                    overflowWrap: "break-word",
                  }}
                >
                  {list.map((p) => (
                    <div key={p.id} style={{ minWidth: 0 }}>
                      {r.cell(p)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          overflowX: "auto",
        }}
      >
        <table
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            width: "100%",
            tableLayout: "fixed",
            minWidth: LABEL_W + COL_MIN * list.length,
          }}
        >
          <colgroup>
            <col style={{ width: LABEL_W }} />
            {list.map((p) => (
              <col key={p.id} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...th, borderBottom: "1px solid var(--line)" }} />
              {list.map((p) => (
                <th key={p.id} scope="col" style={{ ...td, fontWeight: 400, position: "relative" }}>
                  {removeButton(p)}
                  <button
                    type="button"
                    onClick={() => openProduct(p)}
                    aria-label={`View ${p.name}`}
                    style={{
                      display: "block",
                      width: 96,
                      padding: 0,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    <ProductImage product={p} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openProduct(p)}
                    style={{
                      display: "block",
                      marginTop: 8,
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
                    {p.name}
                  </button>
                  <div style={{ marginTop: 10 }}>{addButton(p, false)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" style={th}>
                  {r.label}
                </th>
                {list.map((p) => (
                  <td key={p.id} style={td}>
                    {r.cell(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
