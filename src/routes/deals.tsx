import { Suspense } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useWcm } from "@/wcm/context";
import { PKR } from "@/wcm/data";
import { Icons } from "@/wcm/icons";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProductCard, ProductCardSkeleton } from "@/wcm/products-card-components";
import { Btn } from "@/wcm/ui";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Deals & Offers — Wellcare Mart" },
      {
        name: "description",
        content: "Shop discounted medical supplies and equipment at Wellcare Mart.",
      },
    ],
  }),
  component: DealsPage,
});

function DealsPage() {
  const { products, productsLoaded, addToCart, cart } = useWcm();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const dealProducts = products
    .filter((p) => p.was != null && p.was > p.price)
    .sort((a, b) => {
      const discA = 1 - a.price / a.was!;
      const discB = 1 - b.price / b.was!;
      return discB - discA;
    });

  const cartQtyById = new Map(cart.map((c) => [c.id, c.qty]));

  const totalSaved = dealProducts.reduce((sum, p) => sum + (p.was! - p.price), 0);

  return (
    <div style={{ padding: isMobile ? "16px 0 24px" : "24px 0 32px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#fef2f2",
                color: "#dc2626",
              }}
            >
              {Icons.percent}
            </span>
            <h1
              style={{
                fontSize: isMobile ? 20 : 26,
                fontWeight: 900,
                color: "var(--ink)",
                margin: 0,
                letterSpacing: -0.5,
              }}
            >
              Deals &amp; Offers
            </h1>
          </div>
          {productsLoaded && (
            <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>
              {dealProducts.length} products on sale
              {dealProducts.length > 0 && (
                <span style={{ color: "#dc2626", fontWeight: 700 }}>
                  {" "}
                  · Save up to{" "}
                  {PKR(totalSaved > 0 ? Math.max(...dealProducts.map((p) => p.was! - p.price)) : 0)}
                </span>
              )}
            </p>
          )}
        </div>
        <Btn variant="outline" icon={Icons.home} onClick={() => navigate({ to: "/" })}>
          Shop all
        </Btn>
      </div>

      {/* Grid */}
      {!productsLoaded ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(auto-fill, minmax(190px, 1fr))",
            gap: isMobile ? 8 : 12,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} isMobile={isMobile} />
          ))}
        </div>
      ) : dealProducts.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "64px 24px",
            background: "var(--card)",
            borderRadius: 16,
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏷️</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--ink)", marginBottom: 6 }}>
            No active deals right now
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-4)", marginBottom: 20 }}>
            Check back soon — new deals added regularly.
          </div>
          <Btn onClick={() => navigate({ to: "/" })}>Browse all products</Btn>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(auto-fill, minmax(190px, 1fr))",
            gap: isMobile ? 8 : 12,
            animation: "fadeInUp 0.25s ease",
          }}
        >
          {dealProducts.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              onAdd={addToCart}
              onOpen={(prod) =>
                navigate({ to: "/products/$productId", params: { productId: prod.id } })
              }
              cartQty={cartQtyById.get(p.id) ?? 0}
              compact={isMobile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
