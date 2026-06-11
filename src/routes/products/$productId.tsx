import { Suspense, lazy, useEffect } from "react";
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
    const normalizedId = params.productId.trim().toLowerCase();
    const p = PRODUCTS.find((x) => x.id.toLowerCase() === normalizedId);
    const readableFallbackName = params.productId
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    const productName = p?.name || readableFallbackName || "Product";
    const description = p?.blurb?.trim() || `${productName} at Wellcare Mart.`;

    return {
      title: `${productName} — Wellcare Mart`,
      meta: [
        { title: `${productName} — Wellcare Mart` },
        { name: "description", content: description },
        { property: "og:title", content: `${productName} — Wellcare Mart` },
        { property: "og:description", content: description },
        { name: "twitter:title", content: `${productName} — Wellcare Mart` },
        { name: "twitter:description", content: description },
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

  useEffect(() => {
    const readableFallbackName = productId
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    const productName = product?.name || readableFallbackName || "Product";
    const description = product?.blurb?.trim() || `${productName} at Wellcare Mart.`;

    document.title = `${productName} — Wellcare Mart`;

    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) {
      descriptionMeta.setAttribute("content", description);
    }
  }, [product, productId]);

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
