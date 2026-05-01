import { PKR, type Category, type Product } from "./data";
import { Icons } from "./icons";
import { ProductImage, Stars, Pill } from "./ui";
import { useWcm } from "./context";
import type { CartLine } from "./context";

export function CategoryRail({
  active,
  setActive,
  categories,
}: {
  active: string;
  setActive: (v: string) => void;
  categories: Category[];
}) {
  const allCategoryImages = categories
    .filter((category) => category.id !== "all")
    .map((category) => (typeof category.image_url === "string" ? category.image_url.trim() : ""))
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div
      className="cat-rail"
      style={{
        display: "flex",
        gap: 10,
        overflowX: "auto",
        padding: "6px 2px",
        scrollbarWidth: "none",
      }}
    >
      <style>{`.cat-rail::-webkit-scrollbar{display:none}`}</style>
      {categories.map((c) => {
        const on = c.id === active;
        const categoryImage = typeof c.image_url === "string" ? c.image_url.trim() : "";
        const showAllCollage = c.id === "all" && allCategoryImages.length > 0;
        return (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            style={{
              padding: "10px",
              borderRadius: 16,
              minWidth: 176,
              minHeight: 226,
              background: on ? "linear-gradient(180deg, #ecfdf3 0%, #e4f7ee 100%)" : "#fff",
              color: "var(--ink-2)",
              border: on ? "1px solid #b7ebcc" : "1px solid var(--line)",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 8,
              textAlign: "center",
              flexShrink: 0,
              boxShadow: on ? "0 8px 22px rgba(22, 163, 74, .16)" : "var(--shadow-sm)",
            }}
          >
            {showAllCollage ? (
              <span
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 14,
                  overflow: "hidden",
                  border: on ? "1px solid #86d6a7" : "1px solid var(--line)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gridTemplateRows: "1fr 1fr",
                  gap: 2,
                  flexShrink: 0,
                  background: "var(--bg-elev)",
                  boxShadow: on ? "0 6px 16px rgba(22,163,74,.20)" : "0 2px 8px rgba(0,0,0,.10)",
                }}
              >
                {allCategoryImages.map((src, idx) => (
                  <img
                    key={`all-cat-${idx}`}
                    src={src}
                    alt=""
                    aria-hidden="true"
                    loading="eager"
                    decoding="async"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ))}
              </span>
            ) : categoryImage ? (
              <span
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 14,
                  overflow: "hidden",
                  border: on ? "1px solid #86d6a7" : "1px solid var(--line)",
                  display: "inline-flex",
                  flexShrink: 0,
                  background: "var(--bg-elev)",
                  boxShadow: on ? "0 6px 16px rgba(22,163,74,.20)" : "0 2px 8px rgba(0,0,0,.10)",
                }}
              >
                <img
                  src={categoryImage}
                  alt=""
                  aria-hidden="true"
                  loading="eager"
                  decoding="async"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </span>
            ) : (
              <span
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 14,
                  border: on ? "1px solid #86d6a7" : "1px solid var(--line)",
                  background: "var(--bg-elev)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  color: on ? "#15803d" : "var(--ink-4)",
                }}
              >
                {Icons.pkg}
              </span>
            )}
            <span
              style={{
                lineHeight: 1.15,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                minHeight: 24,
                fontSize: 11.5,
                maxWidth: 150,
              }}
            >
              {c.name}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 99,
                background: on ? "#dcfce7" : "var(--chip-2)",
                color: on ? "#166534" : "var(--ink-4)",
                fontWeight: 700,
                marginTop: "auto",
              }}
            >
              {c.count} items
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ProductCardSkeleton({ isMobile = false }: { isMobile?: boolean }) {
  return (
    <div
      style={{
        background: "var(--card)",
        borderRadius: 14,
        border: "1px solid var(--line)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          height: isMobile ? 132 : 170,
          background: "var(--chip-2)",
          animation: "wcmPulse 1.5s ease-in-out infinite",
        }}
      />
      <div
        style={{
          padding: isMobile ? "8px 8px" : "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? 6 : 7,
        }}
      >
        <div
          style={{
            height: 11,
            width: "40%",
            borderRadius: 6,
            background: "var(--chip-2)",
            animation: "wcmPulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            height: 15,
            width: "80%",
            borderRadius: 6,
            background: "var(--chip-2)",
            animation: "wcmPulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            height: 15,
            width: "55%",
            borderRadius: 6,
            background: "var(--chip-2)",
            animation: "wcmPulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            height: 11,
            width: "50%",
            borderRadius: 6,
            background: "var(--chip-2)",
            animation: "wcmPulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 4,
          }}
        >
          <div
            style={{
              height: 18,
              width: "35%",
              borderRadius: 6,
              background: "var(--chip-2)",
              animation: "wcmPulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: isMobile ? 27 : 30,
              width: isMobile ? 64 : 72,
              borderRadius: 10,
              background: "var(--chip-2)",
              animation: "wcmPulse 1.5s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function ProductCard({
  p,
  onAdd,
  onOpen,
  cartQty,
  compact = false,
}: {
  p: Product;
  onAdd: (p: Product) => void;
  onOpen: (p: Product) => void;
  cartQty: number;
  compact?: boolean;
}) {
  const { wishlist, toggleWishlist, setCart } = useWcm();
  const saved = wishlist.includes(p.id);
  const isInCart = cartQty > 0;

  const removeOneFromCart = () => {
    setCart((current) => {
      const index = current.findIndex((line) => line.id === p.id);
      if (index < 0) return current;

      const line = current[index];
      if (line.qty <= 1) {
        return current.filter((item) => item.id !== p.id);
      }

      return current.map((item, i) => (i === index ? { ...item, qty: item.qty - 1 } : item));
    });
  };

  return (
    <div
      className="wcm-product-card"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        padding: compact ? 8 : 10,
        display: "flex",
        flexDirection: "column",
        gap: compact ? 6 : 8,
        height: "100%",
        boxShadow: "var(--shadow-sm)",
        transition: "transform .15s, box-shadow .15s",
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
      onClick={() => onOpen(p)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "var(--shadow)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <div style={{ position: "relative" }}>
        <ProductImage product={p} />
        {p.was && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 3,
              padding: compact ? "2px 7px" : "3px 8px",
              borderRadius: 99,
              background: "var(--ink)",
              color: "#fff",
              fontSize: compact ? 10 : 11,
              fontWeight: 800,
            }}
          >
            -{Math.round((1 - p.price / p.was) * 100)}%
          </div>
        )}
        <button
          className="wcm-card-hover-action wcm-card-wishlist-btn"
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(p.id);
          }}
          aria-label={saved ? "Remove from saved" : "Save item"}
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 3,
            width: compact ? 26 : 28,
            height: compact ? 26 : 28,
            borderRadius: 99,
            background: "var(--card)",
            border: "1px solid var(--line-2)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: saved ? "#e11d48" : "var(--ink-2)",
            boxShadow: "0 8px 14px -10px rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill={saved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        {isInCart && (
          <span
            key={`qty-badge-${p.id}-${cartQty}`}
            className="wcm-card-qty-badge"
            style={{
              position: "absolute",
              right: 10,
              bottom: 10,
              zIndex: 4,
              minWidth: compact ? 22 : 24,
              height: compact ? 22 : 24,
              padding: "0 7px",
              borderRadius: 99,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--ink)",
              border: "1px solid rgba(255,255,255,.9)",
              color: "#fff",
              fontSize: compact ? 11 : 12,
              fontWeight: 800,
              lineHeight: 1,
              boxShadow: "0 6px 14px -8px rgba(15,23,42,.75)",
            }}
          >
            {cartQty}
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 2 : 3, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {p.tags.slice(0, 1).map((t) => (
            <Pill
              key={t}
              tone={
                t === "Best seller"
                  ? "green"
                  : t === "Top rated"
                    ? "blue"
                    : t === "Deal"
                      ? "rose"
                      : "slate"
              }
            >
              {t}
            </Pill>
          ))}
          <span style={{ fontSize: compact ? 10 : 11, color: "var(--ink-4)", fontWeight: 600 }}>
            {p.brand}
          </span>
        </div>
        <div
          style={{
            fontWeight: 700,
            fontSize: compact ? 13 : 14,
            color: "var(--ink)",
            lineHeight: 1.25,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {p.name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: compact ? 5 : 6,
            fontSize: compact ? 11 : 11.5,
            color: "var(--ink-4)",
          }}
        >
          <Stars value={p.rating} size={12} />
          <span>·</span>
          <span>{p.reviews} reviews</span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 8,
          marginTop: compact ? 0 : 2,
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: compact ? 14 : 16, color: "var(--ink)" }}>
            {PKR(p.price)}
          </div>
          {p.was && (
            <div
              style={{
                fontSize: compact ? 10 : 11,
                color: "var(--ink-4)",
                textDecoration: "line-through",
              }}
            >
              {PKR(p.was)}
            </div>
          )}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {isInCart && (
            <button
              className="wcm-card-step-btn wcm-card-step-btn-minus"
              onClick={(e) => {
                e.stopPropagation();
                removeOneFromCart();
              }}
              aria-label={`Remove one from cart (currently ${cartQty})`}
              title="Remove one"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: compact ? 30 : 34,
                height: compact ? 30 : 34,
                borderRadius: 10,
                border: "1px solid var(--line)",
                cursor: "pointer",
                background: "var(--card)",
                color: "var(--ink-3)",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              {Icons.minus}
            </button>
          )}
          <button
            className="wcm-card-step-btn wcm-card-step-btn-plus wcm-card-hover-action"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(p);
            }}
            aria-label={isInCart ? `Add one more to cart (currently ${cartQty})` : "Add to cart"}
            title={isInCart ? "Add one more" : "Add to cart"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: compact ? 30 : 34,
              height: compact ? 30 : 34,
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: "var(--grad)",
              color: "#fff",
              boxShadow: "0 6px 14px -6px rgba(37,99,235,.4)",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            {Icons.plus}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RecentlyViewedRail({
  ids,
  products,
  cart,
  onAdd,
  onOpen,
  isMobile,
}: {
  ids: string[];
  products: Product[];
  cart: CartLine[];
  onAdd: (p: Product) => void;
  onOpen: (p: Product) => void;
  isMobile: boolean;
}) {
  const viewed = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[];
  if (viewed.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--ink-3)",
          letterSpacing: 0.3,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Recently viewed
      </div>
      <div
        className="wcm-rv-rail"
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 4,
          scrollbarWidth: "none",
        }}
      >
        <style>{`.wcm-rv-rail::-webkit-scrollbar{display:none}`}</style>
        {viewed.map((p) => (
          <div key={p.id} style={{ flexShrink: 0, width: isMobile ? 140 : 170 }}>
            <ProductCard
              p={p}
              onAdd={onAdd}
              onOpen={onOpen}
              cartQty={cart.find((c) => c.id === p.id)?.qty ?? 0}
              compact
            />
          </div>
        ))}
      </div>
    </div>
  );
}
