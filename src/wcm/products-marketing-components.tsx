import { useEffect, useState } from "react";
import { type Category } from "./data";
import { Icons } from "./icons";
import { Btn } from "./ui";

const HERO_BANNERS = [
  {
    eyebrow: "MAY HEALTH SAVINGS · UP TO 30% OFF",
    title: ["Trusted healthcare,", "delivered to your door."],
    lead: "From glucometers to wheelchairs — over 30 essential home-care products from renowned brands. Fast delivery across Pakistan and trusted support after every order.",
    primaryLabel: "Shop products",
    primaryTarget: "products" as const,
    secondaryLabel: "Track an order",
    secondaryTarget: "orders" as const,
    gradient: "linear-gradient(135deg, #2563eb 0%, #0891b2 52%, #22c55e 100%)",
    artCard: {
      kicker: "HEART RATE",
      main: "72",
      suffix: "BPM",
      accent: "#16a34a",
      footerLeft: "SpO2 98%",
      footerRight: "BP 118/76",
    },
    glassCard: {
      kicker: "NEXT DELIVERY",
      main: "Today · 2:15 PM",
      sub: "Order WCM-2840",
    },
  },
  {
    eyebrow: "EVERYDAY ESSENTIALS · CURATED FOR HOME CARE",
    title: ["Care essentials for", "every room in the house."],
    lead: "Blood pressure monitors, patient aids, sugar strips, and more — sourced for families, clinics, and caregivers who need dependable everyday supplies.",
    primaryLabel: "Browse categories",
    primaryTarget: "products" as const,
    secondaryLabel: "Track an order",
    secondaryTarget: "orders" as const,
    gradient: "linear-gradient(135deg, #0f766e 0%, #0ea5e9 48%, #2563eb 100%)",
    artCard: {
      kicker: "ESSENTIALS READY",
      main: "30+",
      suffix: "ITEMS",
      accent: "#0f766e",
      footerLeft: "Trusted brands",
      footerRight: "Home-care focus",
    },
    glassCard: {
      kicker: "POPULAR TODAY",
      main: "BP monitors · walkers",
      sub: "Updated this morning",
    },
  },
  {
    eyebrow: "ORDER SUPPORT · CLEAR, SIMPLE, RELIABLE",
    title: ["Order updates that stay", "clear from checkout to delivery."],
    lead: "Track order progress, confirm delivery details, and send bank-transfer receipts on WhatsApp when needed. The experience stays simple for both COD and prepaid orders.",
    primaryLabel: "Track an order",
    primaryTarget: "orders" as const,
    secondaryLabel: "Shop products",
    secondaryTarget: "products" as const,
    gradient: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 40%, #14b8a6 100%)",
    artCard: {
      kicker: "ORDER STATUS",
      main: "Live",
      suffix: "TRACKING",
      accent: "#2563eb",
      footerLeft: "Updates visible",
      footerRight: "Support ready",
    },
    glassCard: {
      kicker: "WHATSAPP RECEIPTS",
      main: "Share payment proof fast",
      sub: "Useful for bank transfers",
    },
  },
];

export function Hero({ goTo }: { goTo: (p: "products" | "orders") => void }) {
  const [active, setActive] = useState(0);
  const banner = HERO_BANNERS[active];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % HERO_BANNERS.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--radius-lg)",
        background: banner.gradient,
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
            {Icons.sparkle} {banner.eyebrow}
          </div>
          <h1 className="wcm-hero-title">
            {banner.title[0]}
            <br />
            {banner.title[1]}
          </h1>
          <p
            className="wcm-hero-lead"
            style={{ margin: 0, opacity: 0.9, fontSize: 15, maxWidth: 480, lineHeight: 1.5 }}
          >
            {banner.lead}
          </p>
          <div className="wcm-hero-cta" style={{ marginTop: 18 }}>
            <Btn
              variant="solid"
              onClick={() => goTo(banner.primaryTarget)}
              style={{ background: "var(--card)", color: "var(--ink)" }}
              icon={banner.primaryTarget === "products" ? Icons.cart : Icons.truck}
            >
              {banner.primaryLabel}
            </Btn>
            <Btn
              variant="ghost"
              style={{ color: "#fff", border: "1px solid rgba(255,255,255,.4)" }}
              icon={banner.secondaryTarget === "orders" ? Icons.truck : Icons.cart}
              onClick={() => goTo(banner.secondaryTarget)}
            >
              {banner.secondaryLabel}
            </Btn>
          </div>
          <div className="wcm-hero-badges">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {Icons.shield} 100% authentic
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {Icons.refresh} 7-day returns
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
            <div style={{ display: "inline-flex", gap: 8 }}>
              {HERO_BANNERS.map((item, idx) => (
                <button
                  key={item.eyebrow}
                  type="button"
                  aria-label={`Show banner ${idx + 1}`}
                  onClick={() => setActive(idx)}
                  style={{
                    width: idx === active ? 26 : 10,
                    height: 10,
                    borderRadius: 99,
                    border: "none",
                    background: idx === active ? "#fff" : "rgba(255,255,255,.38)",
                    cursor: "pointer",
                    transition: "all .2s ease",
                    padding: 0,
                  }}
                />
              ))}
            </div>
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
              {banner.artCard.kicker}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <div
                style={{
                  fontSize: 38,
                  fontWeight: 800,
                  color: banner.artCard.accent,
                  lineHeight: 1,
                }}
              >
                {banner.artCard.main}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 700 }}>
                {banner.artCard.suffix}
              </div>
            </div>
            <svg width="100%" height="48" viewBox="0 0 160 48" style={{ marginTop: 6 }}>
              <path
                d="M0 28 L28 28 L34 16 L42 40 L50 22 L60 28 L160 28"
                stroke={banner.artCard.accent}
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
              <span>{banner.artCard.footerLeft}</span>
              <span>{banner.artCard.footerRight}</span>
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
            <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 700 }}>
              {banner.glassCard.kicker}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
              {banner.glassCard.main}
            </div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{banner.glassCard.sub}</div>
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
