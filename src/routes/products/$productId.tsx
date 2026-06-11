import { Suspense, lazy, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PRODUCTS } from "@/wcm/data";
import { useWcm } from "@/wcm/context";
import { WellcareLoader } from "@/wcm/loader";
import { Btn } from "@/wcm/ui";

function getSeoSuffix(cat?: string) {
  switch (cat) {
    case "glucometers":
      return "Blood Glucose Meter";
    case "bp-digital":
      return "Digital Blood Pressure Monitor";
    case "bp-manual":
      return "Manual BP Apparatus";
    case "weight-scale":
      return "Weight Scale";
    case "nebulizer":
      return "Nebulizer";
    case "orthobelts-supports":
      return "Orthobelt";
    default:
      return "Medical Product";
  }
}

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
    const seoSuffix = getSeoSuffix(p?.cat);
    const seoTitle = `${productName} ${seoSuffix} — Wellcare Mart`;
    const description =
      p?.blurb?.trim() ||
      `${productName} ${seoSuffix} available at Wellcare Mart with trusted delivery across Pakistan.`;
    const canonical = `https://wellcaremart.pk/products/${params.productId}`;

    return {
      title: seoTitle,
      meta: [
        { title: seoTitle },
        { name: "description", content: description },
        { property: "og:title", content: seoTitle },
        { property: "og:description", content: description },
        { property: "og:url", content: canonical },
        { name: "twitter:title", content: `${productName} — Wellcare Mart` },
        { name: "twitter:description", content: description },
        { name: "keywords", content: `${productName}, ${seoSuffix}, Wellcare Mart, Pakistan` },
        { name: "robots", content: "index, follow" },
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: `${product.name} ${getSeoSuffix(product.cat)}`,
            alternateName: product.name,
            description:
              product.blurb || `${product.name} ${getSeoSuffix(product.cat)} at Wellcare Mart.`,
            brand: product.brand || undefined,
            sku: product.id,
            category: product.category_name || product.cat,
            url: `https://wellcaremart.pk/products/${product.id}`,
            image: product.image_url ? [product.image_url] : undefined,
            offers: {
              "@type": "Offer",
              url: `https://wellcaremart.pk/products/${product.id}`,
              priceCurrency: "PKR",
              price: product.price,
              availability:
                product.stock === "Out of stock"
                  ? "https://schema.org/OutOfStock"
                  : "https://schema.org/InStock",
            },
          }),
        }}
      />
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
