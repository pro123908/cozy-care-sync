import { Suspense, lazy } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useWcm } from "@/wcm/context";
import { WellcareLoader } from "@/wcm/loader";
import { getProductSeoPathSegment } from "@/wcm/data";
import { canonicalUrl } from "@/lib/seo";

const ProductsPage = lazy(() =>
  import("@/wcm/products").then((m) => ({ default: m.ProductsPage })),
);

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    category: typeof search.category === "string" ? search.category : "all",
  }),
  component: IndexPage,
  head: () => ({
    links: [{ rel: "canonical", href: canonicalUrl("/") }],
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
  const { addToCart, cart, products } = useWcm();
  const navigate = useNavigate();
  const { category } = useSearch({ from: "/" });
  return (
    <Suspense fallback={<WellcareLoader label="Loading products" hint="Preparing your catalog" />}>
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
        openProduct={(p) =>
          navigate({
            to: "/products/$productId",
            params: { productId: getProductSeoPathSegment(p, products) },
          })
        }
        goTo={(pg: string) =>
          navigate({
            to: pg === "orders" ? "/orders" : "/",
          })
        }
      />
    </Suspense>
  );
}
