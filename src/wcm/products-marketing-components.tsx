import { useEffect, useState } from "react";
import { type Category } from "./data";
import { Icons } from "./icons";
import { Btn } from "./ui";
import { getSupabase } from "@/integrations/supabase/client";

type HomepageBannerRow = {
  id: string;
  image_url: string;
  alt_text: string;
  sort_order: number;
};

type HeroBanner = {
  eyebrow: string;
  title: [string, string];
  lead: string;
  primaryLabel: string;
  primaryTarget: "products" | "orders";
  secondaryLabel: string;
  secondaryTarget: "products" | "orders";
  gradient: string;
  imageUrl?: string;
  imageAlt?: string;
  artCard: {
    kicker: string;
    main: string;
    suffix: string;
    accent: string;
    footerLeft: string;
    footerRight: string;
  };
  glassCard: {
    kicker: string;
    main: string;
    sub: string;
  };
};

const HERO_BANNERS: HeroBanner[] = [
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
  const [dynamicImages, setDynamicImages] = useState<HomepageBannerRow[]>([]);
  const [bannersResolved, setBannersResolved] = useState(false);
  const [slideTick, setSlideTick] = useState(0);

  const hasDynamicBanners = dynamicImages.length > 0;

  const banners: HeroBanner[] = hasDynamicBanners
    ? dynamicImages.map((row, index) => ({
        ...HERO_BANNERS[index % HERO_BANNERS.length],
        imageUrl: row.image_url,
        imageAlt: row.alt_text || `Homepage banner ${index + 1}`,
      }))
    : HERO_BANNERS;

  const banner = banners[active] || HERO_BANNERS[0];
  const imageOnlyBannerEnabled = hasDynamicBanners && !!banner.imageUrl;
  const showImageCarouselArrows = imageOnlyBannerEnabled && dynamicImages.length > 1;

  const goToPreviousBanner = () => {
    setActive((current) => (current - 1 + banners.length) % banners.length);
  };

  const goToNextBanner = () => {
    setActive((current) => (current + 1) % banners.length);
  };

  useEffect(() => {
    let cancelled = false;

    const loadHomepageBanners = async () => {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("homepage_banners")
        .select("id, image_url, alt_text, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        setBannersResolved(true);
        return;
      }
      if (Array.isArray(data) && data.length > 0) {
        const normalized = (data as HomepageBannerRow[]).filter(
          (row) => typeof row.image_url === "string" && row.image_url.trim().length > 0,
        );
        // Preload all banner images so slide transitions don't flicker
        normalized.forEach((row) => {
          const preload = new Image();
          preload.src = row.image_url;
        });
        setDynamicImages(normalized);
      }
      setBannersResolved(true);
    };

    void loadHomepageBanners();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (active < banners.length) return;
    setActive(0);
  }, [active, banners.length]);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % banners.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  useEffect(() => {
    if (!imageOnlyBannerEnabled) return;
    setSlideTick((current) => current + 1);
  }, [active, imageOnlyBannerEnabled]);

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        transform: "translateZ(0)",
        borderRadius: "var(--radius-lg)",
        background: imageOnlyBannerEnabled
          ? "#0f172a"
          : bannersResolved
            ? banner.gradient
            : "var(--grad-soft)",
        color: "#fff",
        padding: imageOnlyBannerEnabled ? 0 : bannersResolved ? "28px 32px" : 0,
        minHeight: !bannersResolved ? "clamp(180px, 34vw, 360px)" : undefined,
        marginBottom: 18,
      }}
      className={`wcm-hero${imageOnlyBannerEnabled ? " wcm-hero-image-only" : ""}`}
    >
      <style>{`@keyframes wcmHeroFadeIn{from{opacity:0}to{opacity:1}}`}</style>
      {imageOnlyBannerEnabled && (
        <img
          className="wcm-hero-image"
          key={`hero-slide-${slideTick}-${active}`}
          src={banner.imageUrl}
          alt={banner.imageAlt || "Homepage banner"}
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            animation: "wcmHeroFadeIn .35s ease",
          }}
        />
      )}
      {showImageCarouselArrows && (
        <>
          <button
            type="button"
            aria-label="Previous banner"
            onClick={goToPreviousBanner}
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              width: 38,
              height: 38,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.55)",
              background: "rgba(15,23,42,.42)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              backdropFilter: "blur(3px)",
              zIndex: 2,
            }}
          >
            {Icons.chevL}
          </button>
          <button
            type="button"
            aria-label="Next banner"
            onClick={goToNextBanner}
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              width: 38,
              height: 38,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.55)",
              background: "rgba(15,23,42,.42)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              backdropFilter: "blur(3px)",
              zIndex: 2,
            }}
          >
            <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
              {Icons.chevL}
            </span>
          </button>
        </>
      )}
      {bannersResolved && !hasDynamicBanners && (
        <>
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
                  {banners.map((item, idx) => (
                    <button
                      key={`${item.eyebrow}-${idx}`}
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
                <div
                  style={{ fontSize: 10, color: "var(--ink-4)", fontWeight: 700, letterSpacing: 1 }}
                >
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
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                  {banner.glassCard.sub}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
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
