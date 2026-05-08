import { Suspense, lazy } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useWcm } from "@/wcm/context";

const ProductsPage = lazy(() =>
  import("@/wcm/products").then((m) => ({ default: m.ProductsPage })),
);

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    category: typeof search.category === "string" ? search.category : "all",
  }),
  component: IndexPage,
  head: () => ({
    meta: [
      { title: "Wellcare Mart — Medical Supplies & Equipment" },
      {
        name: "description",
        content:
          "Shop trusted medical supplies, monitoring devices, and wellness essentials. Free same-day delivery in Karachi on orders above Rs 2,000.",
      },
      { property: "og:title", content: "Wellcare Mart — Medical Supplies & Equipment" },
      {
        property: "og:description",
        content:
          "Shop trusted medical supplies, monitoring devices, and wellness essentials. Free same-day delivery in Karachi on orders above Rs 2,000.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function IndexPage() {
  const { addToCart, cart } = useWcm();
  const navigate = useNavigate();
  const { category } = useSearch({ from: "/" });
  return (
    <Suspense fallback={<ProductsLoadingFallback />}>
      <ProductsPage
        addToCart={addToCart}
        cart={cart}
        category={category}
        onCategoryChange={(cat) =>
          navigate({
            to: "/",
            search: { category: cat === "all" ? undefined : cat },
            resetScroll: false,
          })
        }
        openProduct={(p) => navigate({ to: "/products/$productId", params: { productId: p.id } })}
        goTo={(pg: string) => navigate({ to: pg === "orders" ? "/orders" : "/" })}
      />
    </Suspense>
  );
}

function ProductsLoadingFallback() {
  return (
    <div
      style={{
        padding: 26,
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: "var(--ink-4)",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="2"
        />
        <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="2.4">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 12 12"
            to="360 12 12"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
      Loading products...
    </div>
  );
}
