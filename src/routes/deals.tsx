import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useWcm } from "@/wcm/context";
import { PKR } from "@/wcm/data";
import { Icons } from "@/wcm/icons";
import { useIsMobile } from "@/hooks/use-mobile";
import { BundleDeals, getBundleOffers } from "@/wcm/products-card-components";
import { Btn } from "@/wcm/ui";
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

function DealsPage() {
  const { products, productsLoaded } = useWcm();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const offers = getBundleOffers(products);
  const maxSaving = offers.length > 0 ? Math.max(...offers.map((o) => o.bundle.discount)) : 0;

  return (
    <div style={{ padding: isMobile ? "16px 0 24px" : "24px 0 32px" }}>
      {/* Header */}
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
                background: "var(--pill-rose-bg)",
                color: "var(--pill-rose-fg)",
              }}
            >
              {Icons.percent}
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
              Deals &amp; Offers
            </h1>
          </div>
          {productsLoaded && offers.length > 0 && (
            <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>
              {offers.length} bundle deals · buy together, save automatically + free delivery
              <span style={{ color: "var(--pill-rose-fg)", fontWeight: 700 }}>
                {" "}
                · Save up to {PKR(maxSaving)}
              </span>
            </p>
          )}
        </div>
        <Btn variant="outline" icon={Icons.home} onClick={() => navigate({ to: "/" })}>
          Shop all
        </Btn>
      </div>

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
