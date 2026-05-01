import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { CATEGORIES, PKR, type Category, type Product } from "./data";
import { Icons } from "./icons";
import { ProductImage, ProductPhoto, Stars, Pill, Btn, Section } from "./ui";
import { useWcm } from "./context";
import type { CartLine } from "./context";
import { useIsMobile } from "@/hooks/use-mobile";

const RECENTLY_VIEWED_KEY = "wcm_recently_viewed";
const RECENTLY_VIEWED_MAX = 12;

function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });

  const trackView = useCallback((id: string) => {
    setIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENTLY_VIEWED_MAX);
      try {
        localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return { ids, trackView };
}

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

function ProductCardSkeleton({ isMobile = false }: { isMobile?: boolean }) {
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
      {/* image placeholder */}
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
        {/* brand */}
        <div
          style={{
            height: 11,
            width: "40%",
            borderRadius: 6,
            background: "var(--chip-2)",
            animation: "wcmPulse 1.5s ease-in-out infinite",
          }}
        />
        {/* name */}
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
        {/* stars */}
        <div
          style={{
            height: 11,
            width: "50%",
            borderRadius: 6,
            background: "var(--chip-2)",
            animation: "wcmPulse 1.5s ease-in-out infinite",
          }}
        />
        {/* price + button */}
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

function ProductCard({
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

function Hero({ goTo }: { goTo: (p: "products" | "orders") => void }) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--radius-lg)",
        background: "var(--grad)",
        color: "#fff",
        padding: "28px 32px",
        marginBottom: 18,
      }}
      className="wcm-hero"
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(800px 200px at 110% 50%, rgba(255,255,255,.18), transparent), radial-gradient(500px 300px at -10% 120%, rgba(255,255,255,.15), transparent)",
        }}
      />
      <div
        className="wcm-hero-cols"
        style={{
          position: "relative",
        }}
      >
        <div>
          <div
            className="wcm-hero-sale"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px",
              borderRadius: 99,
              background: "rgba(255,255,255,.18)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.4,
            }}
          >
            {Icons.sparkle} APRIL HEALTH SAVINGS · UP TO 30% OFF
          </div>
          <h1 className="wcm-hero-title">
            Trusted healthcare,
            <br />
            delivered to your door.
          </h1>
          <p
            className="wcm-hero-lead"
            style={{ margin: 0, opacity: 0.9, fontSize: 15, maxWidth: 480, lineHeight: 1.5 }}
          >
            From glucometers to wheelchairs — over 30 essential home-care products from renowned
            brands. Free same-day delivery in Karachi over Rs 2,000.
          </p>
          <div className="wcm-hero-cta" style={{ marginTop: 18 }}>
            <Btn
              variant="solid"
              onClick={() => goTo("products")}
              style={{ background: "var(--card)", color: "var(--ink)" }}
              icon={Icons.cart}
            >
              Shop products
            </Btn>
            <Btn
              variant="ghost"
              style={{ color: "#fff", border: "1px solid rgba(255,255,255,.4)" }}
              icon={Icons.truck}
              onClick={() => goTo("orders")}
            >
              Track an order
            </Btn>
          </div>
          <div className="wcm-hero-badges">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {Icons.shield} 100% authentic
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {Icons.bolt} Same-day dispatch
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {Icons.refresh} 7-day returns
            </span>
          </div>
        </div>
        <div className="wcm-hero-art" style={{ position: "relative", height: 220 }}>
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 10,
              width: 170,
              height: 130,
              borderRadius: 18,
              background: "var(--card)",
              boxShadow: "0 30px 50px -20px rgba(0,0,0,.35)",
              padding: 14,
            }}
          >
            <div style={{ fontSize: 10, color: "var(--ink-4)", fontWeight: 700, letterSpacing: 1 }}>
              HEART RATE
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <div style={{ fontSize: 38, fontWeight: 800, color: "#16a34a", lineHeight: 1 }}>
                72
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 700 }}>BPM</div>
            </div>
            <svg width="100%" height="48" viewBox="0 0 160 48" style={{ marginTop: 6 }}>
              <path
                d="M0 28 L28 28 L34 16 L42 40 L50 22 L60 28 L160 28"
                stroke="#16a34a"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "var(--ink-4)",
                marginTop: 4,
              }}
            >
              <span>SpO₂ 98%</span>
              <span>BP 118/76</span>
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              right: 140,
              top: 80,
              width: 130,
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(255,255,255,.16)",
              border: "1px solid rgba(255,255,255,.3)",
              backdropFilter: "blur(6px)",
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 700 }}>NEXT DELIVERY</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>Today · 2:15 PM</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>Order WCM-2840</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustRibbon({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`wcm-trust-ribbon${compact ? " wcm-trust-ribbon-compact" : ""}`}>
      <span>{Icons.shield} 100% authentic</span>
      <span>{Icons.bolt} Same-day dispatch</span>
      <span>{Icons.refresh} 7-day returns</span>
    </div>
  );
}

function FeaturedCollectionsStrip({
  categories,
  onSelect,
}: {
  categories: Category[];
  onSelect: (cat: string) => void;
}) {
  const featured = categories
    .filter((cat) => cat.id !== "all" && (cat.count || 0) > 0)
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 3);

  if (featured.length === 0) return null;

  return (
    <div className="wcm-featured-wrap">
      <div className="wcm-featured-head">
        <div className="wcm-featured-kicker">Picked for quick care</div>
        <div className="wcm-featured-title">Featured collections</div>
      </div>
      <div className="wcm-featured-grid">
        {featured.map((cat, idx) => (
          <button
            key={cat.id}
            className="wcm-featured-card"
            onClick={() => onSelect(cat.id)}
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="wcm-featured-card-kicker">
              {(cat.count || 0).toLocaleString()} products
            </div>
            <div className="wcm-featured-card-name">{cat.name}</div>
            <div className="wcm-featured-card-cta">
              Shop now{" "}
              <span style={{ display: "inline-block", transform: "rotate(180deg)" }}>
                {Icons.chevL}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "popular", label: "Most popular" },
  { value: "rating", label: "Top rated" },
  { value: "low", label: "Price: Low to High" },
  { value: "high", label: "Price: High to Low" },
];

const PRODUCTS_PAGE_SIZE = 24;

function getVisiblePaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];

  for (const page of sortedPages) {
    const previous = items[items.length - 1];
    if (typeof previous === "number" && page - previous > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  }

  return items;
}

function SortDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = SORT_OPTIONS.find((o) => o.value === value)!;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "9px 12px",
          borderRadius: 11,
          border: "1px solid var(--line)",
          background: "var(--card)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink-2)",
          fontFamily: "inherit",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {current.label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            opacity: 0.5,
            transition: "transform 0.15s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            minWidth: 180,
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 14px",
                border: "none",
                background: opt.value === value ? "var(--chip-2)" : "transparent",
                fontSize: 13,
                fontWeight: opt.value === value ? 700 : 500,
                color: opt.value === value ? "var(--ink-1)" : "var(--ink-2)",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentlyViewedRail({
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

export function ProductsPage({
  addToCart,
  openProduct,
  cart,
  goTo,
  category,
  onCategoryChange,
}: {
  addToCart: (p: Product) => void;
  openProduct: (p: Product) => void;
  cart: CartLine[];
  goTo: (p: "products" | "orders") => void;
  category?: string;
  onCategoryChange?: (cat: string) => void;
}) {
  const { products, productsLoaded, categories, categoriesLoaded } = useWcm();
  const isMobile = useIsMobile();
  const { ids: recentlyViewedIds } = useRecentlyViewed();
  const [active, setActive] = useState(category ?? "all");
  const [sort, setSort] = useState("popular");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [gridKey, setGridKey] = useState(0);
  const listingTopRef = useRef<HTMLDivElement | null>(null);
  const productsTopRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToProductsRef = useRef(false);
  const hasMountedPaginationRef = useRef(false);

  // Sync active category when URL param changes (e.g. browser back/forward)
  useEffect(() => {
    setActive(category ?? "all");
  }, [category]);

  const filtered = useMemo(() => {
    let arr: Product[] = products;
    if (active !== "all") arr = arr.filter((p) => p.cat === active);
    if (inStockOnly) arr = arr.filter((p) => p.stock !== "Out of stock");
    if (sort === "low") arr = [...arr].sort((a, b) => a.price - b.price);
    if (sort === "high") arr = [...arr].sort((a, b) => b.price - a.price);
    if (sort === "rating") arr = [...arr].sort((a, b) => b.rating - a.rating);
    return arr;
  }, [active, sort, inStockOnly, products]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PAGE_SIZE));
  const pageStart = (page - 1) * PRODUCTS_PAGE_SIZE;
  const pageProducts = filtered.slice(pageStart, pageStart + PRODUCTS_PAGE_SIZE);
  const visiblePaginationItems = useMemo(
    () => getVisiblePaginationItems(page, totalPages),
    [page, totalPages],
  );

  useEffect(() => {
    setPage(1);
  }, [active, sort, inStockOnly]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!productsLoaded) return;
    if (!hasMountedPaginationRef.current) {
      hasMountedPaginationRef.current = true;
      return;
    }
    listingTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page, productsLoaded]);

  useEffect(() => {
    if (!productsLoaded) return;
    if (!shouldScrollToProductsRef.current) return;
    shouldScrollToProductsRef.current = false;
    productsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active, productsLoaded]);

  const cartQtyById = useMemo(() => new Map(cart.map((c) => [c.id, c.qty])), [cart]);
  const storefrontCategories = useMemo(() => {
    const source = categoriesLoaded && categories.length > 0 ? categories : CATEGORIES;
    const counts = products.reduce<Record<string, number>>((acc, product) => {
      acc[product.cat] = (acc[product.cat] || 0) + 1;
      return acc;
    }, {});

    const normalized = source.map((cat) => {
      if (cat.id === "all") {
        return { ...cat, count: products.length };
      }
      return { ...cat, count: counts[cat.id] || 0 };
    });

    if (!normalized.some((cat) => cat.id === "all")) {
      normalized.unshift({ id: "all", name: "All products", count: products.length });
    }

    return normalized;
  }, [categories, categoriesLoaded, products]);

  const hasRecentlyViewed = useMemo(() => {
    if (!recentlyViewedIds.length) return false;
    const productIds = new Set(products.map((product) => product.id));
    return recentlyViewedIds.some((id) => productIds.has(id));
  }, [recentlyViewedIds, products]);

  return (
    <div>
      <Hero goTo={goTo} />
      <TrustRibbon />
      <RecentlyViewedRail
        ids={recentlyViewedIds}
        products={products}
        cart={cart}
        onAdd={addToCart}
        onOpen={openProduct}
        isMobile={isMobile}
      />
      {hasRecentlyViewed ? <div className="wcm-section-divider" /> : null}
      <div ref={listingTopRef} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 6 }}>
        {/* Row 1: Category filter chips */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: "var(--ink-4)",
            paddingInline: 2,
          }}
        >
          Categories
        </div>
        <CategoryRail
          categories={storefrontCategories}
          active={active}
          setActive={(v) => {
            shouldScrollToProductsRef.current = true;
            setActive(v);
            setGridKey((k) => k + 1);
            onCategoryChange?.(v);
          }}
        />
        {/* Row 2: In stock only, item count, sort */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink-3)",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => {
                setInStockOnly(e.target.checked);
                setGridKey((k) => k + 1);
              }}
              style={{ width: 15, height: 15, accentColor: "var(--blue-600)", cursor: "pointer" }}
            />
            In stock only
          </label>
          <span style={{ fontSize: 13, color: "var(--ink-4)", fontWeight: 600 }}>
            Showing {filtered.length === 0 ? 0 : pageStart + 1}-
            {Math.min(pageStart + PRODUCTS_PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <SortDropdown
            value={sort}
            onChange={(v) => {
              setSort(v);
              setGridKey((k) => k + 1);
            }}
          />
        </div>
      </div>

      <div ref={productsTopRef} />

      <FeaturedCollectionsStrip
        categories={storefrontCategories}
        onSelect={(cat) => {
          shouldScrollToProductsRef.current = true;
          setActive(cat);
          setGridKey((k) => k + 1);
          onCategoryChange?.(cat);
        }}
      />

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
      ) : filtered.length === 0 ? (
        <Section
          key={gridKey}
          style={{ padding: 32, textAlign: "center", animation: "fadeInUp 0.25s ease" }}
        >
          <div className="wcm-empty-icon">🔎</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Nothing matches right now</div>
          <div style={{ color: "var(--ink-4)", fontSize: 13, marginTop: 6 }}>
            Clear filters or try one of our fast-moving collections.
          </div>
          <div className="wcm-empty-actions">
            <Btn
              variant="outline"
              icon={Icons.refresh}
              onClick={() => {
                shouldScrollToProductsRef.current = true;
                setActive("all");
                setSort("popular");
                setInStockOnly(false);
                setGridKey((k) => k + 1);
                onCategoryChange?.("all");
              }}
            >
              Reset filters
            </Btn>
            <Btn variant="solid" icon={Icons.sparkle} onClick={() => setSort("rating")}>
              Show top rated
            </Btn>
          </div>
          <div className="wcm-empty-suggestions">
            {storefrontCategories
              .filter((cat) => cat.id !== "all" && (cat.count || 0) > 0)
              .sort((a, b) => (b.count || 0) - (a.count || 0))
              .slice(0, 4)
              .map((cat) => (
                <button
                  key={`empty-${cat.id}`}
                  className="wcm-empty-suggestion-chip"
                  onClick={() => {
                    shouldScrollToProductsRef.current = true;
                    setActive(cat.id);
                    setGridKey((k) => k + 1);
                    onCategoryChange?.(cat.id);
                  }}
                >
                  {cat.name}
                </button>
              ))}
          </div>
        </Section>
      ) : (
        <div
          key={gridKey}
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(auto-fill, minmax(190px, 1fr))",
            gap: isMobile ? 8 : 12,
            animation: "fadeInUp 0.25s ease",
          }}
        >
          {pageProducts.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              onAdd={addToCart}
              onOpen={openProduct}
              cartQty={cartQtyById.get(p.id) ?? 0}
              compact={isMobile}
            />
          ))}
        </div>
      )}

      {productsLoaded && filtered.length > 0 && totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 18,
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              ...paginationBtnStyle,
              opacity: page === 1 ? 0.5 : 1,
              cursor: page === 1 ? "default" : "pointer",
            }}
          >
            Previous
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {visiblePaginationItems.map((item, index) => {
              if (item === "ellipsis") {
                return (
                  <span key={`ellipsis-${index}`} style={paginationEllipsisStyle}>
                    ...
                  </span>
                );
              }

              const activePage = item === page;
              return (
                <button
                  key={item}
                  onClick={() => setPage(item)}
                  style={{
                    ...paginationBtnStyle,
                    minWidth: 40,
                    background: activePage ? "var(--ink)" : "var(--card)",
                    color: activePage ? "#fff" : "var(--ink-2)",
                    borderColor: activePage ? "var(--ink)" : "var(--line)",
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              ...paginationBtnStyle,
              opacity: page === totalPages ? 0.5 : 1,
              cursor: page === totalPages ? "default" : "pointer",
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

const paginationBtnStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 11,
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
};

const paginationEllipsisStyle: React.CSSProperties = {
  minWidth: 24,
  textAlign: "center",
  color: "var(--ink-4)",
  fontSize: 13,
  fontWeight: 700,
};

const qtyBtn: React.CSSProperties = {
  width: 42,
  height: 42,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--card)",
  border: "none",
  color: "var(--ink-2)",
  cursor: "pointer",
};

export function ProductDetail({
  product,
  onClose,
  addToCart,
  cart,
  openProduct,
}: {
  product: Product;
  onClose: () => void;
  addToCart: (p: Product, qty?: number) => void;
  cart: CartLine[];
  openProduct: (p: Product) => void;
}) {
  const { products, categories, categoriesLoaded, wishlist, toggleWishlist } = useWcm();
  const isMobile = useIsMobile();
  const { trackView } = useRecentlyViewed();
  const [qty, setQty] = useState(1);

  // Track this product as recently viewed
  useEffect(() => {
    trackView(product.id);
  }, [product.id, trackView]);
  const [activeView, setActiveView] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const inCart = cart.find((c) => c.id === product.id);
  const isSaved = wishlist.includes(product.id);
  const cat =
    (categoriesLoaded ? categories : CATEGORIES).find((c) => c.id === product.cat)?.name ||
    product.category_name ||
    product.cat;
  const related = products
    .filter((p: Product) => p.cat === product.cat && p.id !== product.id)
    .slice(0, 4);
  const detailImages = useMemo(() => {
    const primary = product.image_url ? [product.image_url] : [];
    const extra = Array.isArray(
      (product as Product & { image_urls?: Array<string | null | undefined> }).image_urls,
    )
      ? ((product as Product & { image_urls?: Array<string | null | undefined> }).image_urls ?? [])
      : [];
    return Array.from(new Set([...primary, ...extra].filter((src): src is string => Boolean(src))));
  }, [product]);
  const hasMultipleImages = detailImages.length > 1;
  const activeImageSrc = detailImages[activeView] ?? detailImages[0] ?? null;
  const thumbIndexes = detailImages.map((_, i) => i);

  useEffect(() => {
    setActiveView(0);
  }, [product.id, detailImages.length]);

  const cycleView = (dir: 1 | -1) => {
    if (detailImages.length <= 1) return;
    setActiveView((v) => (v + dir + detailImages.length) % detailImages.length);
  };
  return (
    <div className="wcm-pdp-wrap" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <button
        className="wcm-pdp-back"
        onClick={onClose}
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
        }}
      >
        {Icons.chevL} Back to products
      </button>
      <TrustRibbon compact />
      <div className="wcm-detail-cols" style={{ alignItems: "start" }}>
        <Section className="wcm-detail-media" style={{ padding: 18 }}>
          <div
            className="wcm-detail-media-hero"
            onTouchStart={(e) => {
              touchStartX.current = e.changedTouches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              if (!hasMultipleImages) return;
              const start = touchStartX.current;
              const end = e.changedTouches[0]?.clientX ?? null;
              if (start == null || end == null) return;
              const delta = end - start;
              if (Math.abs(delta) < 30) return;
              cycleView(delta < 0 ? 1 : -1);
            }}
          >
            {activeImageSrc ? (
              <ProductPhoto
                src={activeImageSrc}
                alt={product.name}
                loading="eager"
                containerStyle={{
                  width: "100%",
                  aspectRatio: "1/1",
                  borderRadius: 12,
                  border: "1px solid var(--line)",
                  background: "var(--bg-elev)",
                }}
                imgStyle={{ objectPosition: "center center" }}
              />
            ) : (
              <ProductImage product={product} />
            )}
          </div>
          {hasMultipleImages && (
            <div
              className="wcm-detail-thumbs-desktop"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 8,
                marginTop: 12,
              }}
            >
              {thumbIndexes.map((i) => (
                <button
                  key={i}
                  onClick={() => setActiveView(i)}
                  aria-label={`Show image ${i + 1}`}
                  style={{
                    aspectRatio: "1/1",
                    borderRadius: 9,
                    border: "1px solid var(--line)",
                    background: `linear-gradient(135deg, var(--bg-elev), var(--chip))`,
                    opacity: i === activeView ? 1 : 0.7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    cursor: "pointer",
                    ...(i === activeView
                      ? {
                          borderColor: "var(--blue-600)",
                          boxShadow: "0 0 0 2px var(--pill-info-bg)",
                        }
                      : {}),
                  }}
                >
                  <ProductPhoto
                    src={detailImages[i]}
                    alt={`${product.name} thumbnail ${i + 1}`}
                    containerStyle={{ width: "100%", height: "100%" }}
                  />
                </button>
              ))}
            </div>
          )}
        </Section>
        <div
          className="wcm-detail-info"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div className="wcm-detail-head-block">
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--ink-4)", fontWeight: 600 }}>{cat}</span>
                <span style={{ color: "var(--ink-4)" }}>·</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--blue-700)" }}>
                  {product.brand}
                </span>
                {product.tags.map((t) => (
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
              </div>
              <button
                className="wcm-pdp-mobile-fav"
                onClick={() => toggleWishlist(product.id)}
                aria-label={isSaved ? "Remove from saved" : "Save item"}
                title={isSaved ? "Remove from saved" : "Save item"}
                style={{
                  width: 34,
                  minWidth: 34,
                  height: 34,
                  borderRadius: 99,
                  border: isSaved ? "1px solid var(--pill-rose-bg)" : "1px solid var(--line)",
                  background: isSaved ? "var(--pill-rose-bg)" : "var(--card)",
                  color: isSaved ? "var(--pill-rose-fg)" : "var(--ink-4)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill={isSaved ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            </div>
            <h1
              style={{
                fontSize: 26,
                margin: "6px 0 4px",
                letterSpacing: -0.4,
                fontWeight: 800,
                lineHeight: 1.15,
              }}
            >
              {product.name}
            </h1>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                color: "var(--ink-4)",
                fontSize: 13,
              }}
            >
              <Stars value={product.rating} /> <span>· {product.reviews} verified reviews</span>
            </div>
          </div>
          <Section
            className="wcm-detail-price-card"
            style={{
              padding: 18,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div
                className="wcm-detail-price-row"
                style={{ display: "flex", alignItems: "baseline", gap: 10 }}
              >
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    color: "var(--ink)",
                    letterSpacing: -0.4,
                  }}
                >
                  {PKR(product.price)}
                </div>
                {product.was && (
                  <div
                    style={{ fontSize: 15, color: "var(--ink-4)", textDecoration: "line-through" }}
                  >
                    {PKR(product.was)}
                  </div>
                )}
                {product.was && <Pill tone="rose">Save {PKR(product.was - product.price)}</Pill>}
              </div>
              <div
                className="wcm-detail-tax-note"
                style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 4 }}
              >
                Inclusive of all taxes · Free delivery over Rs 2,000
              </div>
            </div>
            <div
              className="wcm-detail-stock-pill"
              style={{
                padding: "4px 10px",
                borderRadius: 99,
                background:
                  product.stock === "In stock"
                    ? "var(--pill-success-bg)"
                    : product.stock === "Low stock"
                      ? "var(--pill-warn-bg)"
                      : "var(--pill-rose-bg)",
                color:
                  product.stock === "In stock"
                    ? "var(--pill-success-fg)"
                    : product.stock === "Low stock"
                      ? "var(--pill-warn-fg)"
                      : "var(--pill-rose-fg)",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {Icons.dot} {product.stock}
            </div>
          </Section>
          <div className="wcm-add-row">
            <div
              className="wcm-add-qty"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0,
                border: "1px solid var(--line)",
                borderRadius: 11,
                background: "var(--card)",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="wcm-add-qty-btn"
                style={qtyBtn}
                aria-label="Decrease quantity"
              >
                {Icons.minus}
              </button>
              <div
                className="wcm-add-qty-value"
                style={{ minWidth: 42, textAlign: "center", fontWeight: 700 }}
              >
                {qty}
              </div>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="wcm-add-qty-btn"
                style={qtyBtn}
                aria-label="Increase quantity"
              >
                {Icons.plus}
              </button>
            </div>
            <Btn
              full
              size="lg"
              icon={Icons.cart}
              onClick={() => addToCart(product, qty)}
              style={{ minHeight: 50 }}
            >
              {inCart ? "Update cart" : "Add to cart"} · {PKR(product.price * qty)}
            </Btn>
            <Btn
              variant="outline"
              size="md"
              icon={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={isSaved ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              }
              onClick={() => toggleWishlist(product.id)}
              aria-label={isSaved ? "Remove from saved" : "Save item"}
              style={{
                width: 50,
                minWidth: 50,
                minHeight: 50,
                paddingLeft: 0,
                paddingRight: 0,
                ...(isSaved
                  ? {
                      background: "var(--pill-rose-bg)",
                      color: "var(--pill-rose-fg)",
                      border: "1px solid var(--pill-rose-bg)",
                    }
                  : {}),
              }}
            />
          </div>
          <div className="wcm-pdp-sticky-cta">
            <div
              className="wcm-add-qty"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0,
                border: "1px solid var(--line)",
                borderRadius: 11,
                background: "var(--card)",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="wcm-add-qty-btn"
                style={qtyBtn}
                aria-label="Decrease quantity"
              >
                {Icons.minus}
              </button>
              <div
                className="wcm-add-qty-value"
                style={{ minWidth: 42, textAlign: "center", fontWeight: 700 }}
              >
                {qty}
              </div>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="wcm-add-qty-btn"
                style={qtyBtn}
                aria-label="Increase quantity"
              >
                {Icons.plus}
              </button>
            </div>
            <button
              onClick={() => addToCart(product, qty)}
              className="wcm-pdp-sticky-add"
              style={{
                border: "none",
                borderRadius: 12,
                background: "var(--grad)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                padding: "12px 14px",
                fontFamily: "inherit",
                cursor: "pointer",
                flex: 1,
                minHeight: 44,
              }}
            >
              {(inCart ? "Update cart" : "Add to cart") + " · " + PKR(product.price * qty)}
            </button>
          </div>
          {hasMultipleImages && (
            <div className="wcm-detail-thumbs-mobile">
              {thumbIndexes.map((i) => (
                <button
                  key={`mobile-thumb-${i}`}
                  onClick={() => setActiveView(i)}
                  aria-label={`Show image ${i + 1}`}
                  style={{
                    aspectRatio: "1/1",
                    borderRadius: 9,
                    border: "1px solid var(--line)",
                    background: `linear-gradient(135deg, var(--bg-elev), var(--chip))`,
                    opacity: i === activeView ? 1 : 0.7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    cursor: "pointer",
                    ...(i === activeView
                      ? {
                          borderColor: "var(--blue-600)",
                          boxShadow: "0 0 0 2px var(--pill-info-bg)",
                        }
                      : {}),
                  }}
                >
                  <ProductPhoto
                    src={detailImages[i]}
                    alt={`${product.name} thumbnail ${i + 1}`}
                    containerStyle={{ width: "100%", height: "100%" }}
                  />
                </button>
              ))}
            </div>
          )}
          <Section style={{ padding: 16 }}>
            <div
              style={{
                fontWeight: 700,
                marginBottom: 8,
                fontSize: 13,
                letterSpacing: 0.3,
                color: "var(--ink-3)",
                textTransform: "uppercase",
              }}
            >
              About this product
            </div>
            <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 14, lineHeight: 1.55 }}>
              {product.blurb}
            </p>
            <div
              className="wcm-detail-meta-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2,1fr)",
                gap: 10,
                marginTop: 12,
              }}
            >
              {[
                { l: "Brand", v: product.brand },
                { l: "Category", v: cat },
                { l: "Warranty", v: "6 months brand" },
                { l: "Returns", v: "7-day easy returns" },
              ].map((r) => (
                <div
                  key={r.l}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--line)",
                    borderRadius: 11,
                    background: "var(--bg-elev)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 600 }}>{r.l}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>{r.v}</div>
                </div>
              ))}
            </div>
          </Section>
          <div className="wcm-product-badges">
            {[
              { i: Icons.truck, t: "Same-day dispatch", s: "Order before 4 PM" },
              { i: Icons.shield, t: "100% authentic", s: "Direct from brands" },
              { i: Icons.refresh, t: "7-day returns", s: "No questions asked" },
            ].map((b) => (
              <div
                key={b.t}
                style={{
                  padding: 12,
                  borderRadius: 11,
                  background: "var(--bg-elev)",
                  border: "1px solid var(--line)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                <div style={{ color: "var(--blue-700)" }}>{b.i}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{b.t}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{b.s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <h2 style={{ fontSize: 18, margin: 0, fontWeight: 800, letterSpacing: -0.2 }}>
              You may also like
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(auto-fill, minmax(220px, 1fr))",
              gap: isMobile ? 8 : 14,
            }}
          >
            {related.map((r) => (
              <ProductCard
                key={r.id}
                p={r}
                onAdd={addToCart}
                onOpen={openProduct}
                cartQty={cart.find((c) => c.id === r.id)?.qty ?? 0}
                compact={isMobile}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
