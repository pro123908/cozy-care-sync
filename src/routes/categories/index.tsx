import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CATEGORIES } from "@/wcm/data";
import { useWcm } from "@/wcm/context";
import { useIsMobile } from "@/hooks/use-mobile";
import { Icons } from "@/wcm/icons";
import { Btn } from "@/wcm/ui";

export const Route = createFileRoute("/categories/")({
  head: () => ({
    meta: [
      { title: "Browse Categories — Wellcare Mart" },
      {
        name: "description",
        content: "Explore all Wellcare Mart categories and shop products by category.",
      },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { categories, categoriesLoaded, products } = useWcm();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const source = categoriesLoaded && categories.length > 0 ? categories : CATEGORIES;
  const counts = products.reduce<Record<string, number>>((acc, product) => {
    acc[product.cat] = (acc[product.cat] || 0) + 1;
    return acc;
  }, {});

  const storefrontCategories = source
    .filter((cat) => cat.id !== "all")
    .map((cat) => ({ ...cat, count: counts[cat.id] || 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#ecfeff",
                color: "#0f766e",
              }}
            >
              {Icons.pkg}
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
              All Categories
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>
            {storefrontCategories.length} categories available
          </p>
        </div>
        <Btn variant="outline" icon={Icons.home} onClick={() => navigate({ to: "/" })}>
          Shop all
        </Btn>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile
            ? "repeat(2, minmax(0, 1fr))"
            : "repeat(auto-fill, minmax(160px, 1fr))",
          gap: isMobile ? 10 : 12,
        }}
      >
        {storefrontCategories.map((category) => {
          const categoryImage =
            typeof category.image_url === "string" ? category.image_url.trim() : "";
          return (
            <button
              key={category.id}
              onClick={() =>
                navigate({
                  to: "/categories/$categoryId",
                  params: { categoryId: category.id },
                })
              }
              style={{
                position: "relative",
                padding: "2px 2px 8px",
                borderRadius: 14,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 10,
                cursor: "pointer",
                textAlign: "center",
                background: "transparent",
                border: "none",
                fontFamily: "inherit",
                transition: "transform .2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 2,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "3px 10px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 0.25,
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  color: "#fff",
                  background: "linear-gradient(135deg, #ef4444, #b91c1c)",
                  boxShadow: "0 8px 16px -10px rgba(127, 29, 29, 0.85)",
                }}
              >
                Flat 20% off
              </span>
              <span
                style={{
                  width: isMobile ? 112 : 128,
                  height: isMobile ? 112 : 128,
                  borderRadius: 999,
                  overflow: "hidden",
                  border: "2px solid #ffffff",
                  display: "inline-flex",
                  flexShrink: 0,
                  background: categoryImage ? "#ffffff" : "#e2e8f0",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 10px 20px rgba(15,23,42,.12)",
                }}
              >
                {categoryImage ? (
                  <img
                    src={categoryImage}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      display: "block",
                      boxSizing: "border-box",
                      padding: "8%",
                      background: "#ffffff",
                    }}
                  />
                ) : (
                  <span style={{ color: "var(--ink-4)", fontSize: 22 }}>{Icons.pkg}</span>
                )}
              </span>
              <div>
                <div
                  style={{
                    lineHeight: 1.2,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    minHeight: 34,
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "var(--ink-2)",
                    maxWidth: isMobile ? 120 : 138,
                    textTransform: "capitalize",
                  }}
                >
                  {category.name}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
