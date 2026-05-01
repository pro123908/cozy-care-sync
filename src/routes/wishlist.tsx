import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useWcm } from "@/wcm/context";
import { PKR } from "@/wcm/data";
import { ProductImage, Btn } from "@/wcm/ui";
import { Icons } from "@/wcm/icons";

export const Route = createFileRoute("/wishlist")({
  component: WishlistPage,
});

function WishlistPage() {
  const { wishlist, toggleWishlist, addToCart, products } = useWcm();
  const navigate = useNavigate();
  const saved = products.filter((p) => wishlist.includes(p.id));
  const suggestions = [...products].sort((a, b) => b.rating - a.rating).slice(0, 3);

  return (
    <div
      style={{
        maxWidth: 800,
        margin: "40px auto",
        padding: "0 20px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <button
        onClick={() => navigate({ to: "/" })}
        style={{
          background: "none",
          border: "none",
          color: "var(--ink-3)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          padding: 0,
          alignSelf: "flex-start",
        }}
      >
        {Icons.chevL} Back
      </button>

      <div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>Saved items</div>
        <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 4 }}>
          {saved.length === 0
            ? "No items saved yet"
            : `${saved.length} item${saved.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {saved.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 0",
            color: "var(--ink-4)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 48,
              opacity: 0.9,
              width: 68,
              height: 68,
              borderRadius: 18,
              background: "var(--grad-soft)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: 34, height: 34 }}
            >
              <path d="M12 21s-7-4.5-9-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 5.5-9 10-9 10Z" />
            </svg>
          </span>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>
            Nothing saved yet
          </div>
          <div style={{ fontSize: 13, maxWidth: 340 }}>
            Tap the heart on any product to keep your essentials in one place.
          </div>
          <Btn onClick={() => navigate({ to: "/" })} icon={Icons.cart}>
            Browse products
          </Btn>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {suggestions.map((product) => (
              <button
                key={`ws-suggest-${product.id}`}
                onClick={() =>
                  navigate({ to: "/products/$productId", params: { productId: product.id } })
                }
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 99,
                  padding: "7px 11px",
                  background: "var(--card)",
                  color: "var(--ink-3)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {product.name.length > 24 ? `${product.name.slice(0, 24)}...` : product.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          {saved.map((p) => (
            <div
              key={p.id}
              style={{
                background: "var(--card)",
                borderRadius: 18,
                border: "1px solid var(--line)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{ position: "relative", cursor: "pointer" }}
                onClick={() =>
                  navigate({ to: "/products/$productId", params: { productId: p.id } })
                }
              >
                <ProductImage product={p} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWishlist(p.id);
                  }}
                  aria-label="Remove from saved"
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 30,
                    height: 30,
                    borderRadius: 99,
                    background: "rgba(255,255,255,0.9)",
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#e11d48",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>
              <div
                style={{
                  padding: "14px 14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  flex: 1,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>
                  {PKR(p.price)}
                </div>
                <Btn
                  full
                  onClick={() => addToCart(p)}
                  icon={Icons.cart}
                  style={{ marginTop: "auto" }}
                >
                  Add to cart
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
