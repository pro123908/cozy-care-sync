import { createFileRoute } from "@tanstack/react-router";
import { ProductFinder } from "@/wcm/product-finder";
import { useIsMobile } from "@/hooks/use-mobile";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/finder")({
  validateSearch: (search: Record<string, unknown>) => ({
    // Optional preselected need (e.g. ?need=bp) so ads can deep-link past step 1.
    need: typeof search.need === "string" ? search.need : undefined,
    // Which entry point was used (feeds the FinderStart event); known values only.
    from:
      search.from === "home page" || search.from === "header" || search.from === "bottom bar"
        ? search.from
        : undefined,
  }),
  head: () => ({
    links: [{ rel: "canonical", href: canonicalUrl("/finder") }],
    meta: [
      { title: "Find the Right Product — Wellcare Mart" },
      {
        name: "description",
        content:
          "Not sure which glucometer, BP monitor, walker or hearing aid to choose? Answer a few quick questions and get our top picks.",
      },
    ],
  }),
  component: FinderPage,
});

function FinderPage() {
  const isMobile = useIsMobile();
  const { need, from } = Route.useSearch();
  return (
    <div
      style={{ maxWidth: 720, margin: "0 auto", padding: isMobile ? "16px 0 32px" : "28px 0 48px" }}
    >
      <h1
        style={{
          margin: "0 0 4px",
          fontSize: isMobile ? 21 : 26,
          fontWeight: 900,
          letterSpacing: -0.5,
          color: "var(--ink)",
        }}
      >
        Find the right product
      </h1>
      <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--ink-4)" }}>
        A few quick questions, then our top picks.
      </p>
      <ProductFinder initialNeed={need} source={from} />
    </div>
  );
}
