import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProductsPage } from "@/wcm/products";
import { useWcm } from "@/wcm/context";

export const Route = createFileRoute("/")({
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
  return (
    <ProductsPage
      addToCart={addToCart}
      cart={cart}
      openProduct={(p) => navigate({ to: "/products/$productId", params: { productId: p.id } })}
      goTo={(pg: string) => navigate({ to: pg === "orders" ? "/orders" : "/" })}
    />
  );
}
