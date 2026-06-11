import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CATEGORIES } from "@/wcm/data";
import { useWcm } from "@/wcm/context";
import { useIsMobile } from "@/hooks/use-mobile";
import { Icons } from "@/wcm/icons";
import { Btn } from "@/wcm/ui";
import { ProductCard, ProductCardSkeleton } from "@/wcm/products-card-components";

export const Route = createFileRoute("/categories/$categoryId")({
  head: ({ params }: { params: { categoryId: string } }) => ({
    meta: [
      { title: `${startCase(params.categoryId)} — Category — Wellcare Mart` },
      {
        name: "description",
        content: "Browse products in this category at Wellcare Mart.",
      },
    ],
  }),
  component: CategoryProductsPage,
});

function startCase(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function CategoryProductsPage() {
  const { categoryId } = Route.useParams();
  const { products, productsLoaded, addToCart, cart, categories, categoriesLoaded } = useWcm();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const resolvedCategoryId =
    categoryId === "weight-scale-digital" || categoryId === "weight-scale-manual"
      ? "weight-scale"
      : categoryId;

  const source = categoriesLoaded && categories.length > 0 ? categories : CATEGORIES;
  const category = source.find((c) => c.id === resolvedCategoryId);
  const categoryName = category?.name || startCase(resolvedCategoryId);

  const categoryProducts = products.filter((p) => p.cat === resolvedCategoryId);
  const cartQtyById = new Map(cart.map((c) => [c.id, c.qty]));

  if (!category) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧭</div>
        <div style={{ fontWeight: 800, fontSize: 18, color: "var(--ink)", marginBottom: 6 }}>
          Category not found
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-4)", marginBottom: 20 }}>
          We could not find this category.
        </div>
        <Btn onClick={() => navigate({ to: "/categories" })}>Back to categories</Btn>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? "16px 0 24px" : "24px 0 32px" }}>
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
            <button
              onClick={() => navigate({ to: "/categories" })}
              aria-label="Back to categories"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--card)",
                color: "var(--ink-2)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              {Icons.chevL}
            </button>
            <h1
              style={{
                fontSize: isMobile ? 20 : 26,
                fontWeight: 900,
                color: "var(--ink)",
                margin: 0,
                letterSpacing: -0.5,
                textTransform: "capitalize",
              }}
            >
              {categoryName}
            </h1>
          </div>
          {productsLoaded && (
            <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>
              {categoryProducts.length} products in this category
            </p>
          )}
        </div>
        <Btn variant="outline" icon={Icons.home} onClick={() => navigate({ to: "/" })}>
          Shop all
        </Btn>
      </div>

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
      ) : categoryProducts.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "64px 24px",
            background: "var(--card)",
            borderRadius: 16,
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--ink)", marginBottom: 6 }}>
            No products in this category yet
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-4)", marginBottom: 20 }}>
            Please check another category.
          </div>
          <Btn onClick={() => navigate({ to: "/categories" })}>Browse categories</Btn>
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
          {categoryProducts.map((product) => (
            <ProductCard
              key={product.id}
              p={product}
              onAdd={addToCart}
              onOpen={(prod) =>
                navigate({ to: "/products/$productId", params: { productId: prod.id } })
              }
              cartQty={cartQtyById.get(product.id) ?? 0}
              compact={isMobile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
