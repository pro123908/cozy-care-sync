import React, { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PKR, getDisplayPrice, getProductBadge, getSelectableOptions, type Category, type Product } from "./data";
import { Icons } from "./icons";
import { ProductImage, Stars, Pill } from "./ui";
import { useWcm, useProductRatings } from "./context";
import type { CartLine } from "./context";

export function CategoryRail({
  active,
  setActive,
  categories,
  onViewAll,
  isMobile = false,
}: {
  active: string;
  setActive: (v: string) => void;
  categories: Category[];
  onViewAll?: () => void;
  isMobile?: boolean;
}) {
  const allCategoryImages = categories
    .filter((category) => category.id !== "all")
    .map((category) => (typeof category.image_url === "string" ? category.image_url.trim() : ""))
    .filter(Boolean)
    .slice(0, 4);
  const visibleCategories = categories;

  return (
    <>
      <style>{`.cat-rail::-webkit-scrollbar{display:none}`}</style>
      <div
        className="cat-rail"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: "3px 2px",
          justifyContent: "center",
          overflowX: "visible",
          overflowY: "visible",
          scrollbarWidth: "none",
        }}
      >
        {visibleCategories.map((c) => {
          const on = c.id === active;
          const categoryImage = typeof c.image_url === "string" ? c.image_url.trim() : "";
          const showAllCollage = c.id === "all" && allCategoryImages.length > 0;
          const showOfferBadge = c.id !== "all";
          return (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              style={{
                position: "relative",
                padding: "2px 2px 6px",
                borderRadius: 14,
                minWidth: 135,
                width: 135,
                background: "transparent",
                color: "var(--ink-2)",
                border: "none",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 12,
                textAlign: "center",
                flexShrink: 0,
                transition: "transform .2s ease",
              }}
            >
              {showOfferBadge ? (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 3,
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
                    background: "var(--grad)",
                    boxShadow: "0 8px 16px -10px rgba(37, 99, 235, 0.45)",
                  }}
                >
                  Flat 20% off
                </span>
              ) : null}
              {showAllCollage ? (
                <span
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 999,
                    overflow: "hidden",
                    border: on ? "3px solid #0f766e" : "2px solid var(--card)",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gridTemplateRows: "1fr 1fr",
                    gap: 2,
                    flexShrink: 0,
                    background: "#f7f7f7",
                    boxShadow: on
                      ? "0 0 0 3px rgba(15,118,110,.18), 0 12px 22px rgba(15,23,42,.18)"
                      : "0 10px 20px rgba(15,23,42,.12)",
                  }}
                >
                  {allCategoryImages.map((src, idx) => (
                    <img
                      key={`all-cat-${idx}`}
                      src={src}
                      alt=""
                      aria-hidden="true"
                      width={52}
                      height={52}
                      loading="eager"
                      decoding="async"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ))}
                </span>
              ) : categoryImage ? (
                <span
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 999,
                    overflow: "hidden",
                    border: on ? "3px solid #0f766e" : "2px solid var(--card)",
                    display: "inline-flex",
                    flexShrink: 0,
                    background: "#ffffff",
                    boxShadow: on
                      ? "0 0 0 3px rgba(15,118,110,.18), 0 12px 22px rgba(15,23,42,.18)"
                      : "0 10px 20px rgba(15,23,42,.12)",
                  }}
                >
                  <img
                    src={categoryImage}
                    alt=""
                    aria-hidden="true"
                    width={104}
                    height={104}
                    loading="eager"
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
                </span>
              ) : (
                <span
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 999,
                    border: on ? "3px solid #0f766e" : "2px solid var(--card)",
                    background: "#e2e8f0",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    color: on ? "#0f766e" : "var(--ink-4)",
                    boxShadow: on
                      ? "0 0 0 3px rgba(15,118,110,.18), 0 12px 22px rgba(15,23,42,.18)"
                      : "0 10px 20px rgba(15,23,42,.12)",
                  }}
                >
                  {Icons.pkg}
                </span>
              )}
              <span
                style={{
                  lineHeight: 1.2,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  minHeight: 34,
                  fontSize: 13.5,
                  fontWeight: on ? 800 : 700,
                  color: on ? "var(--ink)" : "var(--ink-2)",
                  maxWidth: 138,
                  textTransform: "capitalize",
                }}
              >
                {c.name}
              </span>
            </button>
          );
        })}
        {onViewAll && (
          <button
            key="cat-view-all"
            onClick={onViewAll}
            style={{
              padding: "2px 2px 6px",
              borderRadius: 14,
              minWidth: 135,
              width: 135,
              background: "transparent",
              color: "var(--ink-2)",
              border: "none",
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 12,
              textAlign: "center",
              flexShrink: 0,
              transition: "transform .2s ease",
            }}
          >
            <span
              style={{
                width: 104,
                height: 104,
                borderRadius: 999,
                border: "2px dashed var(--blue-300)",
                background: "var(--card)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--blue-700)",
                boxShadow: "0 10px 20px rgba(15,23,42,.08)",
              }}
            >
              {Icons.chev}
            </span>
            <span
              style={{
                lineHeight: 1.2,
                minHeight: 34,
                fontSize: 13.5,
                fontWeight: 700,
                color: "var(--blue-700)",
                maxWidth: 138,
              }}
            >
              View all
            </span>
          </button>
        )}
      </div>
    </>
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
  const { wishlist, toggleWishlist, setCart, addToCart } = useWcm();
  const getProductRatings = useProductRatings();
  const { average: userRating, count: reviewCount } = getProductRatings(p.id);
  const saved = wishlist.includes(p.id);
  const isInCart = cartQty > 0;
  const displayPrice = getDisplayPrice(p);
  const selectableOptions = getSelectableOptions(p);
  const hasSelectableOptions = selectableOptions.length > 0;
  const [showSizePicker, setShowSizePicker] = useState(false);
  const sizePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSizePicker) return;
    const closeIfOutside = (e: MouseEvent) => {
      if (sizePickerRef.current && !sizePickerRef.current.contains(e.target as Node)) {
        setShowSizePicker(false);
      }
    };
    document.addEventListener("mousedown", closeIfOutside);
    return () => document.removeEventListener("mousedown", closeIfOutside);
  }, [showSizePicker]);
  const resolvedReviewCount = reviewCount || p.reviews;
  const resolvedRating = Number(userRating || p.rating || 0);
  const showReviewSummary = resolvedReviewCount > 0;
  const badge = getProductBadge(p);
  const primaryTag = badge?.label ?? "";
  const primaryTagTone = badge?.tone ?? "slate";
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
              // Fixed dark (not var(--ink), which flips to near-white in dark
              // mode) — this floats over a product photo, so it needs to stay
              // a dark pill with white text regardless of page theme.
              background: "rgba(15, 23, 42, 0.9)",
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
              // Same fixed-dark reasoning as the discount badge above.
              background: "rgba(15, 23, 42, 0.9)",
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
        <div
          style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minHeight: 24 }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: compact ? "2px 8px" : "3px 10px",
              borderRadius: 999,
              background: "var(--chip-2)",
              border: "1px solid var(--line)",
              fontSize: compact ? 10 : 11,
              color: "var(--ink-3)",
              fontWeight: 700,
              letterSpacing: 0.15,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
              maxWidth: "100%",
              textTransform: "capitalize",
              lineHeight: 1.15,
            }}
          >
            {p.brand}
          </span>
          {primaryTag ? <Pill tone={primaryTagTone}>{primaryTag}</Pill> : null}
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
        {showReviewSummary && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: compact ? 5 : 6,
              fontSize: compact ? 11 : 11.5,
              color: "var(--ink-4)",
            }}
          >
            <Stars value={resolvedRating} size={12} />
            <span style={{ fontWeight: 700 }}>{resolvedRating.toFixed(1)}</span>
            <span>·</span>
            <span>{resolvedReviewCount} reviews</span>
          </div>
        )}
        <span
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            margin: -1,
            padding: 0,
            border: 0,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
          }}
        >
          {`${p.name}. Brand ${p.brand}. Category ${p.category_name || p.cat}. Rated ${resolvedRating.toFixed(1)} out of 5 from ${resolvedReviewCount} reviews.`}
        </span>
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
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              fontWeight: 800,
              fontSize: compact ? 14 : 16,
              color: "var(--ink)",
            }}
          >
            {PKR(displayPrice)}
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
          {isInCart && !hasSelectableOptions && (
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
          <div ref={sizePickerRef} style={{ position: "relative" }}>
            <button
              className="wcm-card-step-btn wcm-card-step-btn-plus wcm-card-hover-action"
              onClick={(e) => {
                e.stopPropagation();
                if (hasSelectableOptions) {
                  setShowSizePicker((v) => !v);
                  return;
                }
                onAdd(p);
              }}
              disabled={!hasSelectableOptions && cartQty >= 5}
              aria-label={
                hasSelectableOptions
                  ? "Choose a size"
                  : isInCart
                    ? `Add one more to cart (currently ${cartQty})`
                    : "Add to cart"
              }
              title={
                hasSelectableOptions ? "Choose a size" : isInCart ? "Add one more" : "Add to cart"
              }
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
                opacity: !hasSelectableOptions && cartQty >= 5 ? 0.5 : 1,
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              {Icons.plus}
            </button>
            {showSizePicker && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  right: 0,
                  zIndex: 10,
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  boxShadow: "var(--shadow)",
                  padding: 5,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  minWidth: 130,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--ink-4)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    padding: "4px 8px 2px",
                  }}
                >
                  Choose a size
                </div>
                {selectableOptions.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart(p, 1, opt.label);
                      setShowSizePicker(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "7px 8px",
                      borderRadius: 7,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "var(--ink)",
                      textAlign: "left",
                      fontFamily: "inherit",
                      WebkitTapHighlightColor: "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--chip)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span>{opt.label}</span>
                    <span style={{ color: "var(--ink-4)", fontWeight: 600 }}>{PKR(opt.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
    <div style={{ marginBottom: 10, minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--ink-4)",
          letterSpacing: 0.3,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        Recently viewed
      </div>
      <div
        className="wcm-rv-rail"
        style={{
          display: "flex",
          contain: "layout paint",
          gap: 8,
          width: "100%",
          minWidth: 0,
          maxWidth: "100%",
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorX: "contain",
          touchAction: "pan-x pan-y",
          paddingBottom: 4,
          scrollbarWidth: "none",
        }}
      >
        <style>{`.wcm-rv-rail::-webkit-scrollbar{display:none}`}</style>
        {viewed.map((p) => (
          <div key={p.id} style={{ flex: "0 0 auto", width: isMobile ? 110 : 130 }}>
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

export function DealsRail({
  products,
  cart,
  onAdd,
  onOpen,
  isMobile,
}: {
  products: Product[];
  cart: CartLine[];
  onAdd: (p: Product) => void;
  onOpen: (p: Product) => void;
  isMobile: boolean;
}) {
  const deals = products
    .filter((p) => p.was != null && p.was > p.price)
    .sort((a, b) => (1 - a.price / a.was! - (1 - b.price / b.was!) > 0 ? -1 : 1))
    .slice(0, 12);

  if (deals.length === 0) return null;

  return (
    <div style={{ marginBottom: 10, minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 800,
            color: "var(--ink)",
            letterSpacing: -0.1,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: 6,
              background: "var(--pill-rose-bg)",
              color: "var(--pill-rose-fg)",
              flexShrink: 0,
            }}
          >
            {Icons.percent}
          </span>
          Deals &amp; Offers
        </div>
        <Link
          to="/deals"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--blue-700)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 3,
            whiteSpace: "nowrap",
          }}
        >
          View all {Icons.chev}
        </Link>
      </div>
      <div
        className="wcm-deals-rail"
        style={{
          display: "flex",
          contain: "layout paint",
          gap: 8,
          width: "100%",
          minWidth: 0,
          maxWidth: "100%",
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorX: "contain",
          touchAction: "pan-x pan-y",
          paddingBottom: 4,
          scrollbarWidth: "none",
        }}
      >
        <style>{`.wcm-deals-rail::-webkit-scrollbar{display:none}`}</style>
        {deals.map((p) => (
          <div key={p.id} style={{ flex: "0 0 auto", width: isMobile ? 130 : 160 }}>
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
