import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useWcm } from "@/wcm/context";
import { PKR, BUNDLE_DEALS_END_MS } from "@/wcm/data";
import { useIsMobile } from "@/hooks/use-mobile";
import { BundleDeals, getBundleOffers } from "@/wcm/products-card-components";
import { Btn } from "@/wcm/ui";
import { BundleCountdownTiles, useBundlesActive } from "@/wcm/bundle-clock";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/deals")({
  head: () => ({
    links: [{ rel: "canonical", href: canonicalUrl("/deals") }],
    meta: [
      { title: "Deals & Offers — Wellcare Mart" },
      {
        name: "description",
        content:
          "Bundle deals on medical supplies and equipment at Wellcare Mart — buy together and save automatically.",
      },
    ],
  }),
  component: DealsPage,
});

const endLabel = () =>
  new Date(BUNDLE_DEALS_END_MS).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

function DealsPage() {
  const { products, productsLoaded } = useWcm();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const active = useBundlesActive();

  const offers = getBundleOffers(products);
  const maxSaving = offers.length > 0 ? Math.max(...offers.map((o) => o.bundle.discount)) : 300;

  return (
    <div style={{ padding: isMobile ? "16px 0 24px" : "24px 0 32px" }}>
      {active && (
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            marginBottom: 18,
            padding: isMobile ? "16px 16px 16px 20px" : "18px 24px 18px 28px",
            borderRadius: 16,
            background: "var(--card)",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            gap: isMobile ? 14 : 24,
          }}
        >
          <span
            aria-hidden="true"
            style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: "var(--grad)" }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: isMobile ? 21 : 26,
                  fontWeight: 900,
                  letterSpacing: -0.5,
                  color: "var(--ink)",
                }}
              >
                Bundle deals
              </h1>
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "var(--pill-rose-bg)",
                  color: "var(--pill-rose-fg)",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                Save up to {PKR(maxSaving)}
              </span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.45 }}>
              Buy together and save — free delivery, applied automatically.
              {productsLoaded && offers.length > 0 ? ` ${offers.length} bundles.` : ""}
            </p>
          </div>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-4)", marginBottom: 7 }}>
              ⏳ Ends {endLabel()}
            </div>
            <BundleCountdownTiles />
          </div>
        </div>
      )}

      {!productsLoaded ? (
        <div style={{ minHeight: 220 }} aria-hidden="true" />
      ) : offers.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "64px 24px",
            background: "var(--card)",
            borderRadius: 16,
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏷️</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--ink)", marginBottom: 6 }}>
            No active deals right now
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-4)", marginBottom: 20 }}>
            Check back soon — new deals added regularly.
          </div>
          <Btn onClick={() => navigate({ to: "/" })}>Browse all products</Btn>
        </div>
      ) : (
        <BundleDeals products={products} isMobile={isMobile} layout="grid" />
      )}
    </div>
  );
}
