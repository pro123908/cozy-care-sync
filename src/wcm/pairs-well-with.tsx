import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useWcm } from "./context";
import {
  BUNDLES,
  PKR,
  bundlesActive,
  getDisplayPrice,
  getProductSeoPathSegment,
  getSelectableOptions,
  isOutOfStockBlocked,
  type Product,
} from "./data";
import { Btn, ProductImage, Section } from "./ui";
import { trackBundleClick } from "@/lib/meta-pixel";

// Compatible add-ons for a product, taken from the curated BUNDLES pairs (meter +
// its matching strips, BP monitor + stethoscope, ...). It is deliberately NOT called
// "frequently bought together": order history is far too thin for that claim, and a
// wrong strip for a meter is worse than no suggestion.
type Pair = { partner: Product; discount: number };

function pairsFor(product: Product, products: Product[]): Pair[] {
  const pairs: Pair[] = [];
  for (const b of BUNDLES) {
    if (!b.ids.includes(product.id)) continue;
    const partnerId = b.ids[0] === product.id ? b.ids[1] : b.ids[0];
    const partner = products.find((p) => p.id === partnerId);
    if (
      !partner ||
      partner.price <= 0 ||
      partner.stock === "Out of stock" ||
      isOutOfStockBlocked(partner)
    )
      continue;
    pairs.push({ partner, discount: b.discount });
  }
  return pairs
    .sort(
      (a, b) =>
        b.discount - a.discount ||
        (b.partner.delivered_sales_count ?? 0) - (a.partner.delivered_sales_count ?? 0),
    )
    .slice(0, 3);
}

export function PairsWellWith({ product }: { product: Product }) {
  const { products, cart, addToCart } = useWcm();
  const navigate = useNavigate();
  const pairs = useMemo(() => pairsFor(product, products), [product, products]);
  if (pairs.length === 0 || product.stock === "Out of stock" || isOutOfStockBlocked(product))
    return null;

  const productInCart = cart.some((c) => c.id === product.id);
  const dealOn = bundlesActive();

  return (
    <Section className="wcm-detail-pairs" style={{ padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
        Pairs well with
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pairs.map(({ partner, discount }) => {
          const needsChoice =
            getSelectableOptions(partner).length > 0 || getSelectableOptions(product).length > 0;
          const pairTotal =
            getDisplayPrice(product) + getDisplayPrice(partner) - (dealOn ? discount : 0);
          const open = () =>
            navigate({
              to: "/products/$productId",
              params: { productId: getProductSeoPathSegment(partner, products) },
            });
          return (
            <div key={partner.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                onClick={open}
                aria-label={`View ${partner.name}`}
                style={{
                  width: 56,
                  flexShrink: 0,
                  padding: 0,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <ProductImage product={partner} />
              </button>
              <div style={{ minWidth: 0, flex: 1 }}>
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
                    fontSize: 13.5,
                    fontWeight: 800,
                    color: "var(--ink)",
                    lineHeight: 1.3,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {partner.name}
                </button>
                <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginTop: 2 }}>
                  {PKR(getDisplayPrice(partner))}
                  {dealOn ? ` · save ${PKR(discount)} together` : ""}
                </div>
              </div>
              {needsChoice ? (
                <Btn size="sm" variant="outline" onClick={open} style={{ flexShrink: 0 }}>
                  View
                </Btn>
              ) : (
                <Btn
                  size="sm"
                  onClick={() => {
                    if (!productInCart) addToCart(product);
                    addToCart(partner);
                    trackBundleClick({
                      productIds: [product.id, partner.id],
                      label: `${product.name} + ${partner.name}`,
                      source: "product page",
                      extra: { kind: "pairs well with" },
                    });
                  }}
                  style={{ flexShrink: 0 }}
                >
                  {productInCart ? "Add" : `Add both · ${PKR(pairTotal)}`}
                </Btn>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
