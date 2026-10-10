import { useNavigate } from "@tanstack/react-router";
import { useWcm } from "./context";
import {
  OUT_OF_STOCK_ALTERNATIVES,
  PKR,
  getDisplayPrice,
  getProductSeoPathSegment,
  isOutOfStockBlocked,
  type Product,
} from "./data";
import { Btn, ProductImage, Section } from "./ui";

// "In stock now" substitute for an out-of-stock product, from the curated
// OUT_OF_STOCK_ALTERNATIVES map. Renders nothing unless the product is out of stock
// and a mapped alternative is actually available.
export function OutOfStockAlternative({ product }: { product: Product }) {
  const { products } = useWcm();
  const navigate = useNavigate();
  if (product.stock !== "Out of stock" && !isOutOfStockBlocked(product)) return null;

  const alt = (OUT_OF_STOCK_ALTERNATIVES[product.id] ?? [])
    .map((id) => products.find((p) => p.id === id))
    .find((p): p is Product => !!p && p.price > 0 && p.stock !== "Out of stock");
  if (!alt) return null;

  const open = () => {
    navigate({
      to: "/products/$productId",
      params: { productId: getProductSeoPathSegment(alt, products) },
    });
  };

  return (
    <Section className="wcm-detail-alternative" style={{ padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
        Similar product, in stock
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={open}
          aria-label={`View ${alt.name}`}
          style={{
            width: 64,
            flexShrink: 0,
            padding: 0,
            border: "none",
            background: "none",
            cursor: "pointer",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <ProductImage product={alt} />
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
            {alt.name}
          </button>
          <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginTop: 2 }}>
            {PKR(getDisplayPrice(alt))}
          </div>
        </div>
        <Btn size="sm" onClick={open} style={{ flexShrink: 0 }}>
          View
        </Btn>
      </div>
    </Section>
  );
}
