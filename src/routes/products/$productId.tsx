import { Suspense, lazy } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PRODUCTS } from "@/wcm/data";
import { useWcm } from "@/wcm/context";
import { WellcareLoader } from "@/wcm/loader";
import { Btn } from "@/wcm/ui";

const ProductDetail = lazy(() =>
  import("@/wcm/products").then((m) => ({ default: m.ProductDetail })),
);

export const Route = createFileRoute("/products/$productId")({
  component: ProductPage,
  head: ({ params }: { params: { productId: string } }) => {
    const p = PRODUCTS.find((x) => x.id === params.productId);
    const title = p ? `${p.name} — Wellcare Mart` : "Product — Wellcare Mart";
    const description = p
      ? p.blurb || `Shop ${p.name} from Wellcare Mart. Learn more about the product, pricing, and availability.`
      : "Product details and availability at Wellcare Mart.";

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: `/products/${params.productId}` },
        ...(p?.image_url ? [{ property: "og:image", content: p.image_url }] : []),
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
});

function ProductPage() {
  const { productId } = Route.useParams();
  const { addToCart, cart, products, productsLoaded } = useWcm();
  const navigate = useNavigate();
  const product =
    products.find((p) => p.id === productId) || PRODUCTS.find((p) => p.id === productId);

  if (!product && !productsLoaded) {
    return <WellcareLoader label="Loading product" compact />;
  }

  if (!product) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔎</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Product not found</div>
        <div style={{ color: "var(--ink-4)", fontSize: 14, marginBottom: 20 }}>
          This product doesn't exist or may have been removed.
        </div>
        <Btn onClick={() => navigate({ to: "/" })}>Back to shop</Btn>
      </div>
    );
  }

  return (
    <Suspense fallback={<WellcareLoader label="Loading product" compact />}>
      <ProductDetail
        product={product}
        cart={cart}
        addToCart={addToCart}
        onClose={() => navigate({ to: "/" })}
        openProduct={(p) => navigate({ to: "/products/$productId", params: { productId: p.id } })}
      />
    </Suspense>
  );
}
