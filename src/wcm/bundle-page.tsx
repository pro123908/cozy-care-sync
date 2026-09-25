import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PKR, findBundleBySlug, getSelectableOptions, getProductSeoPathSegment, isOutOfStockBlocked, type Product } from "./data";
import { useWcm } from "./context";
import { useIsMobile } from "@/hooks/use-mobile";
import { Btn, ProductImage } from "./ui";
import { BundleCountdown, useBundlesActive } from "./bundle-clock";
import { trackBundleClick } from "@/lib/meta-pixel";

/**
 * Landing page for one ready-made bundle (linked from the ad carousel's
 * cards). The discount + free delivery are applied automatically in the cart
 * (computeBundles), so "Add both" just puts the pair in it.
 */
export function BundlePage({ slug }: { slug: string }) {
  const { products, productsLoaded, addToCart } = useWcm();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const active = useBundlesActive();

  const bundle = findBundleBySlug(slug);
  const [a, b] = bundle ? bundle.ids.map((id) => products.find((p) => p.id === id)) : [];

  useEffect(() => {
    if (a && b) document.title = `${a.name} + ${b.name} Bundle — Wellcare Mart`;
  }, [a, b]);

  if (!productsLoaded) return <div style={{ minHeight: 320 }} aria-hidden="true" />;

  // Unknown bundle, a product gone from the catalog, or one needing an option
  // pick ("Add both" can't choose it for the buyer).
  if (!bundle || !a || !b || getSelectableOptions(a).length > 0 || getSelectableOptions(b).length > 0) {
    return <Notice title="Bundle not found" text="This bundle isn't available." />;
  }
  if (isOutOfStockBlocked(a) || isOutOfStockBlocked(b)) {
    return <Notice title="This bundle is out of stock" text="One of the products in this bundle is currently out of stock." />;
  }
  if (!active) {
    return <Notice title="This bundle offer has ended" text="You can still buy both products at their regular prices." />;
  }

  const total = a.price + b.price;
  const price = total - bundle.discount;

  const addBoth = (goToCheckout: boolean) => {
    trackBundleClick({
      productIds: [a.id, b.id],
      label: `${a.name} + ${b.name}`,
      source: "bundle page",
      value: price,
      extra: { action: goToCheckout ? "order now" : "add both" },
    });
    addToCart(a, 1);
    addToCart(b, 1);
    if (goToCheckout) navigate({ to: "/checkout" });
  };

  return (
    <div style={{ padding: isMobile ? "12px 0 28px" : "20px 0 36px", maxWidth: 980, margin: "0 auto" }}>
      <Link
        to="/deals"
        style={{ fontSize: 13, fontWeight: 700, color: "var(--blue-700)", textDecoration: "none" }}
      >
        ← All bundle deals
      </Link>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1.1fr) minmax(0, 1fr)",
          gap: isMobile ? 16 : 28,
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 8 : 12,
            padding: isMobile ? 12 : 18,
            borderRadius: 16,
            background: "var(--card)",
            border: "1px solid var(--line)",
          }}
        >
          <ImageLink product={a} products={products} />
          <span
            aria-hidden="true"
            style={{
              width: 30,
              height: 30,
              flexShrink: 0,
              borderRadius: 999,
              background: "var(--grad)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 1,
              paddingBottom: 3,
            }}
          >
            +
          </span>
          <ImageLink product={b} products={products} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            <Pill bg="var(--pill-success-bg)" fg="var(--pill-success-fg)">Save {PKR(bundle.discount)}</Pill>
            <Pill bg="var(--pill-teal-bg)" fg="var(--pill-teal-fg)">
              <span aria-hidden="true">🚚</span> Free delivery
            </Pill>
            <BundleCountdown />
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: isMobile ? 21 : 26,
              fontWeight: 900,
              letterSpacing: -0.5,
              lineHeight: 1.25,
              color: "var(--ink)",
            }}
          >
            {a.name} <span style={{ color: "var(--blue-700)" }}>+</span> {b.name}
          </h1>
          <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: isMobile ? 28 : 34, fontWeight: 900, color: "var(--ink)", letterSpacing: -0.5 }}>
              {PKR(price)}
            </span>
            <span style={{ fontSize: 15, color: "var(--ink-4)", textDecoration: "line-through" }}>{PKR(total)}</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 12.5, color: "var(--ink-4)" }}>
            Inclusive of all taxes · discount applied automatically in your cart
          </div>

          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            <Btn full size="lg" onClick={() => addBoth(true)}>
              Order now · {PKR(price)}
            </Btn>
            <Btn full size="lg" variant="outline" onClick={() => addBoth(false)}>
              Add both to cart
            </Btn>
          </div>

          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12.5, fontWeight: 700, color: "var(--ink-3)" }}>
            <span>✔ 100% authentic</span>
            <span>✔ 3-day returns</span>
            <span>✔ Cash on delivery</span>
          </div>
        </div>
      </div>

      <h2 style={{ margin: "28px 0 10px", fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>What's included</h2>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        {[a, b].map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              gap: 12,
              padding: 12,
              borderRadius: 14,
              background: "var(--card)",
              border: "1px solid var(--line)",
              minWidth: 0,
            }}
          >
            <div style={{ width: 84, height: 84, flexShrink: 0, borderRadius: 10, overflow: "hidden" }}>
              <ProductImage product={p} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-4)", margin: "2px 0 4px" }}>{PKR(p.price)} on its own</div>
              {p.blurb?.trim() && (
                <div style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.45 }}>{p.blurb.trim()}</div>
              )}
              <Link
                to="/products/$productId"
                params={{ productId: getProductSeoPathSegment(p, products) }}
                style={{ display: "inline-block", marginTop: 6, fontSize: 12.5, fontWeight: 700, color: "var(--blue-700)", textDecoration: "none" }}
              >
                View details →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageLink({ product, products }: { product: Product; products: Product[] }) {
  return (
    <Link
      to="/products/$productId"
      params={{ productId: getProductSeoPathSegment(product, products) }}
      aria-label={product.name}
      style={{ flex: "1 1 0", minWidth: 0, borderRadius: 12, overflow: "hidden", display: "block" }}
    >
      <ProductImage product={product} />
    </Link>
  );
}

function Pill({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  const navigate = useNavigate();
  return (
    <div
      style={{
        textAlign: "center",
        padding: "64px 24px",
        margin: "24px 0",
        background: "var(--card)",
        borderRadius: 16,
        border: "1px solid var(--line)",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 18, color: "var(--ink)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--ink-4)", marginBottom: 20 }}>{text}</div>
      <Btn onClick={() => navigate({ to: "/" })}>Browse all products</Btn>
    </div>
  );
}
