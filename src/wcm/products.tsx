import React, { useMemo, useState, useRef, useEffect } from "react";
import { CATEGORIES, PKR, type Product } from "./data";
import { Icons } from "./icons";
import { ProductImage, Stars, Pill, Btn, Section } from "./ui";
import { useWcm } from "./context";
import type { CartLine } from "./context";

export function CategoryRail({
  active,
  setActive,
}: {
  active: string;
  setActive: (v: string) => void;
}) {
  return (
    <div
      className="cat-rail"
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        padding: "4px 2px",
        scrollbarWidth: "none",
      }}
    >
      <style>{`.cat-rail::-webkit-scrollbar{display:none}`}</style>
      {CATEGORIES.map((c) => {
        const on = c.id === active;
        return (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            style={{
              padding: "9px 14px",
              borderRadius: 99,
              whiteSpace: "nowrap",
              background: on ? "var(--ink)" : "#fff",
              color: on ? "#fff" : "var(--ink-2)",
              border: on ? "1px solid var(--ink)" : "1px solid var(--line)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {c.name}
            <span
              style={{
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 99,
                background: on ? "rgba(255,255,255,.15)" : "var(--chip-2)",
                color: on ? "rgba(255,255,255,.85)" : "var(--ink-4)",
              }}
            >
              {c.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div
      style={{
        background: "var(--card)",
        borderRadius: 18,
        border: "1px solid var(--line)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* image placeholder */}
      <div
        style={{
          height: 200,
          background: "var(--chip-2)",
          animation: "wcmPulse 1.5s ease-in-out infinite",
        }}
      />
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
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
              height: 34,
              width: 80,
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
  inCart,
}: {
  p: Product;
  onAdd: (p: Product) => void;
  onOpen: (p: Product) => void;
  inCart: boolean;
}) {
  const { wishlist, toggleWishlist } = useWcm();
  const saved = wishlist.includes(p.id);
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxShadow: "var(--shadow-sm)",
        transition: "transform .15s, box-shadow .15s",
        cursor: "pointer",
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
              top: 10,
              right: 10,
              padding: "3px 8px",
              borderRadius: 99,
              background: "var(--ink)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            -{Math.round((1 - p.price / p.was) * 100)}%
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(p.id);
          }}
          aria-label={saved ? "Remove from saved" : "Save item"}
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            width: 30,
            height: 30,
            borderRadius: 99,
            background: "rgba(255,255,255,0.9)",
            border: "none",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: saved ? "#e11d48" : "var(--ink-4)",
            boxShadow: "var(--shadow-sm)",
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
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
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
          <span style={{ fontSize: 11.5, color: "var(--ink-4)", fontWeight: 600 }}>{p.brand}</span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink)", lineHeight: 1.3 }}>
          {p.name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
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
          marginTop: 4,
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)" }}>{PKR(p.price)}</div>
          {p.was && (
            <div style={{ fontSize: 12, color: "var(--ink-4)", textDecoration: "line-through" }}>
              {PKR(p.was)}
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd(p);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 12px",
            borderRadius: 11,
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 13,
            background: inCart ? "var(--pill-success-bg)" : "var(--grad)",
            color: inCart ? "var(--pill-success-fg)" : "#fff",
            boxShadow: inCart ? "none" : "0 6px 14px -6px rgba(37,99,235,.4)",
          }}
        >
          {inCart ? <>{Icons.check} In cart</> : <>{Icons.plus} Add</>}
        </button>
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
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div>
          <div
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
          <p style={{ margin: 0, opacity: 0.9, fontSize: 15, maxWidth: 480, lineHeight: 1.5 }}>
            From glucometers to wheelchairs — over 30 essential home-care products from renowned
            brands. Free same-day delivery in Karachi over Rs 2,000.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
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

const SORT_OPTIONS = [
  { value: "popular", label: "Most popular" },
  { value: "rating", label: "Top rated" },
  { value: "low", label: "Price: Low to High" },
  { value: "high", label: "Price: High to Low" },
];

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

export function ProductsPage({
  addToCart,
  openProduct,
  cart,
  goTo,
}: {
  addToCart: (p: Product) => void;
  openProduct: (p: Product) => void;
  cart: CartLine[];
  goTo: (p: "products" | "orders") => void;
}) {
  const { products, productsLoaded } = useWcm();
  const [active, setActive] = useState("all");
  const [sort, setSort] = useState("popular");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [gridKey, setGridKey] = useState(0);

  const filtered = useMemo(() => {
    let arr: Product[] = products;
    if (active !== "all") arr = arr.filter((p) => p.cat === active);
    if (inStockOnly) arr = arr.filter((p) => p.stock !== "Out of stock");
    if (sort === "low") arr = [...arr].sort((a, b) => a.price - b.price);
    if (sort === "high") arr = [...arr].sort((a, b) => b.price - a.price);
    if (sort === "rating") arr = [...arr].sort((a, b) => b.rating - a.rating);
    return arr;
  }, [active, sort, inStockOnly, products]);

  const inCartIds = new Set(cart.map((c) => c.id));

  return (
    <div>
      <Hero goTo={goTo} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
        {/* Row 1: Category filter chips */}
        <CategoryRail
          active={active}
          setActive={(v) => {
            setActive(v);
            setGridKey((k) => k + 1);
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
            {filtered.length} items
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

      {!productsLoaded ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
            gap: 14,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Section
          key={gridKey}
          style={{ padding: 48, textAlign: "center", animation: "fadeInUp 0.25s ease" }}
        >
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔎</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>No products in this category</div>
          <div style={{ color: "var(--ink-4)", fontSize: 13, marginTop: 4 }}>
            Try a different category or filter.
          </div>
        </Section>
      ) : (
        <div
          key={gridKey}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
            gap: 14,
            animation: "fadeInUp 0.25s ease",
          }}
        >
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              onAdd={addToCart}
              onOpen={openProduct}
              inCart={inCartIds.has(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const qtyBtn: React.CSSProperties = {
  width: 36,
  height: 38,
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
  const { products } = useWcm();
  const [qty, setQty] = useState(1);
  const inCart = cart.find((c) => c.id === product.id);
  const cat = CATEGORIES.find((c) => c.id === product.cat)?.name;
  const related = products
    .filter((p: Product) => p.cat === product.cat && p.id !== product.id)
    .slice(0, 4);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <button
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
      <div
        className="wcm-detail-cols"
        style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 24, alignItems: "start" }}
      >
        <Section style={{ padding: 18 }}>
          <ProductImage product={product} />
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 12 }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  aspectRatio: "1/1",
                  borderRadius: 9,
                  border: "1px solid var(--line)",
                  background: `linear-gradient(135deg, var(--bg-elev), var(--chip))`,
                  opacity: i === 0 ? 1 : 0.55,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--ink-4)",
                  fontSize: 10,
                  fontWeight: 700,
                  ...(i === 0
                    ? { borderColor: "var(--blue-600)", boxShadow: "0 0 0 2px var(--pill-info-bg)" }
                    : {}),
                }}
              >
                view {i + 1}
              </div>
            ))}
          </div>
        </Section>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
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
            style={{
              padding: 18,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
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
              <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 4 }}>
                Inclusive of all taxes · Free delivery over Rs 2,000
              </div>
            </div>
            <div
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
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={qtyBtn}>
                {Icons.minus}
              </button>
              <div style={{ minWidth: 42, textAlign: "center", fontWeight: 700 }}>{qty}</div>
              <button onClick={() => setQty((q) => q + 1)} style={qtyBtn}>
                {Icons.plus}
              </button>
            </div>
            <Btn full size="lg" icon={Icons.cart} onClick={() => addToCart(product, qty)}>
              {inCart ? "Update cart" : "Add to cart"} · {PKR(product.price * qty)}
            </Btn>
            <Btn variant="outline" size="lg" icon={Icons.heart} aria-label="Favorite" />
          </div>
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
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            {related.map((r) => (
              <ProductCard
                key={r.id}
                p={r}
                onAdd={addToCart}
                onOpen={openProduct}
                inCart={cart.some((c) => c.id === r.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
