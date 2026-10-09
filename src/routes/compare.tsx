import { useEffect, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useWcm } from "@/wcm/context";
import type { Product } from "@/wcm/data";
import {
  COMPARE_MAX,
  compareClear,
  compareSet,
  copyCompareLink,
  useCompareEntries,
} from "@/wcm/compare";
import { CompareView } from "@/wcm/compare-view";
import { Btn } from "@/wcm/ui";
import { useIsMobile } from "@/hooks/use-mobile";
import { NOINDEX_FOLLOW_META, canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/compare")({
  // `ids` makes a comparison linkable ("/compare?ids=bd-012,bd-013"); it is loaded into
  // the shopper's selection on arrival and then dropped from the URL. Shoppers normally
  // compare in the popup (see compare-modal.tsx); this page backs shared links.
  validateSearch: (search: Record<string, unknown>) => ({
    ids: typeof search.ids === "string" ? search.ids : undefined,
  }),
  head: () => ({
    links: [{ rel: "canonical", href: canonicalUrl("/compare") }],
    meta: [{ title: "Compare Products — Wellcare Mart" }, NOINDEX_FOLLOW_META],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { products, productsLoaded } = useWcm();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const search = Route.useSearch() as { ids?: string };
  const urlIds = search.ids;
  const entries = useCompareEntries();

  // Shared link: load its products into the selection once the catalog is known.
  useEffect(() => {
    if (!urlIds || !productsLoaded) return;
    const wanted = urlIds
      .split(",")
      .map((id) => products.find((p) => p.id === id.trim()))
      .filter((p): p is Product => Boolean(p));
    if (wanted.length > 0) {
      const cat = wanted[0].cat;
      compareSet(wanted.filter((p) => p.cat === cat).map((p) => ({ id: p.id, cat: p.cat })));
    }
    navigate({ to: "/compare", search: { ids: undefined }, replace: true });
  }, [urlIds, productsLoaded, products, navigate]);

  const list = useMemo(
    () =>
      entries
        .map((e) => products.find((p) => p.id === e.id))
        .filter((p): p is Product => Boolean(p)),
    [entries, products],
  );

  const heading = (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 14,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: isMobile ? 21 : 26,
            fontWeight: 900,
            letterSpacing: -0.5,
            color: "var(--ink)",
          }}
        >
          Compare products
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--ink-4)" }}>
          Up to {COMPARE_MAX} products from the same category.
        </p>
      </div>
      {list.length > 0 && (
        <div style={{ display: "flex", gap: 8 }}>
          {list.length >= 2 && (
            <Btn size="sm" variant="outline" onClick={() => copyCompareLink(list)}>
              Copy link
            </Btn>
          )}
          <Btn size="sm" variant="outline" onClick={compareClear}>
            Clear all
          </Btn>
        </div>
      )}
    </div>
  );

  const pad = isMobile ? "16px 0 24px" : "24px 0 32px";

  if (!productsLoaded && entries.length > 0) {
    return <div style={{ padding: pad, minHeight: 260 }}>{heading}</div>;
  }

  if (list.length < 2) {
    return (
      <div style={{ padding: pad }}>
        {heading}
        <div
          style={{
            textAlign: "center",
            padding: "48px 16px",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 16,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", marginBottom: 6 }}>
            {list.length === 0 ? "Nothing to compare yet" : "Pick one more product"}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--ink-4)", marginBottom: 16 }}>
            Tap Compare on a product page to start.
          </div>
          <Btn onClick={() => navigate({ to: "/" })}>Browse products</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: pad }}>
      {heading}
      <CompareView list={list} source="compare page" />
    </div>
  );
}
