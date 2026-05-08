import { type Category } from "./data";
import { Icons } from "./icons";
import { Btn } from "./ui";

export function Hero({ goTo }: { goTo: (p: "products" | "orders") => void }) {
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
            {Icons.sparkle} MAY HEALTH SAVINGS · UP TO 30% OFF
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
              <span>SpO2 98%</span>
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

export function TrustRibbon({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`wcm-trust-ribbon${compact ? " wcm-trust-ribbon-compact" : ""}`}>
      <span>{Icons.shield} 100% authentic</span>
      <span>{Icons.bolt} Same-day dispatch</span>
      <span>{Icons.refresh} 7-day returns</span>
    </div>
  );
}

export function FeaturedCollectionsStrip({
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
      <div className="wcm-featured-head"></div>
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
