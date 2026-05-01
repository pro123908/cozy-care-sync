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
    ],
  }),
});

function IndexPage() {
  const { addToCart, cart } = useWcm();
  const navigate = useNavigate();
  const { category } = useSearch({ from: "/" });
  return (
    <Suspense
      fallback={<div style={{ padding: 20, color: "var(--ink-4)" }}>Loading products…</div>}
    >
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
