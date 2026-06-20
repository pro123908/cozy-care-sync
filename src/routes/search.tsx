import { useEffect, useState, useCallback } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useWcm } from "@/wcm/context";
import { type Product, getProductSeoPathSegment } from "@/wcm/data";
import { getSupabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProductCard, ProductCardSkeleton } from "@/wcm/products-card-components";
import { WellcareLoader } from "@/wcm/loader";

const PAGE_SIZE = 24;
const POPULAR = ["Glucometer", "Wheelchair", "Pulse oximeter", "Nebulizer", "Blood pressure monitor"];

const SORT_OPTIONS = [
  { value: "relevance", label: "Best match" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({
    q:    typeof s.q    === "string" ? s.q    : "",
    cat:  typeof s.cat  === "string" ? s.cat  : "all",
    sort: typeof s.sort === "string" ? s.sort : "relevance",
    page: typeof s.page === "number" ? s.page : 1,
  }),
  component: SearchPage,
  head: ({ match }) => {
    const q = (match.search as { q?: string }).q ?? "";
    return {
      meta: [
        { title: q ? `"${q}" — Search — Wellcare Mart` : "Search — Wellcare Mart" },
        { name: "robots", content: "noindex,follow" },
      ],
    };
  },
});

type SearchRow = Product & { total_count: number };

function SearchPage() {
  const isMobile = useIsMobile();
  const navigate  = useNavigate();
  const { q, cat, sort, page } = useSearch({ from: "/search" });
  const { addToCart, cart, categories: ctxCategories } = useWcm();

  const [results, setResults]       = useState<SearchRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [fetched, setFetched]       = useState(false);

  const totalCount = results[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const cartQtyById = new Map(cart.map((item) => [item.id, item.qty]));

  const runSearch = useCallback(async () => {
    setLoading(true);
    setFetched(false);
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc("search_products", {
      q:          q.trim(),
      cat_filter: cat,
      sort_by:    sort,
      p_offset:   (page - 1) * PAGE_SIZE,
      p_limit:    PAGE_SIZE,
    });
    setLoading(false);
    setFetched(true);
    if (error || !data) { setResults([]); return; }
    setResults(
      (data as SearchRow[]).map((r) => ({
        ...r,
        sales_count: r.sales_count ?? 0,
        tags:        Array.isArray(r.tags) ? r.tags : [],
        blurb:       r.blurb ?? "",
        swatch:      r.swatch ?? "",
        rating:      Number(r.rating ?? 0),
        reviews:     Number(r.reviews ?? 0),
        size_options: Array.isArray((r as unknown as { size_options?: unknown }).size_options)
          ? (r as unknown as { size_options: { size: string; price: number }[] }).size_options
          : [],
        variant_options: Array.isArray((r as unknown as { variant_options?: unknown }).variant_options)
          ? (r as unknown as { variant_options: { name: string; price: number }[] }).variant_options
          : [],
      }))
    );
  }, [q, cat, sort, page]);

  useEffect(() => { runSearch(); }, [runSearch]);

  const setParam = (key: string, value: string | number) =>
    navigate({ to: "/search", search: (prev: Record<string, unknown>) => ({ ...prev, [key]: value, page: 1 }) });

  const openProduct = (p: Product) =>
    navigate({ to: "/products/$productId", params: { productId: getProductSeoPathSegment(p, results) } });

  const padding = isMobile ? "0" : "0 20px 60px";

  return (
    <div style={{ padding, maxWidth: 1200, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ padding: isMobile ? "14px 0 10px" : "20px 0 14px" }}>
        {q ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, margin: 0 }}>
              Results for <span style={{ color: "var(--blue-600)" }}>"{q}"</span>
            </h1>
            {fetched && !loading && (
              <span style={{ fontSize: 13, color: "var(--ink-4)", fontWeight: 500 }}>
                {totalCount.toLocaleString()} product{totalCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        ) : (
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, margin: 0 }}>
            Browse all products
          </h1>
        )}
      </div>

      {/* ── Filters row ── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        {/* Category chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
          <button
            onClick={() => setParam("cat", "all")}
            style={{
              padding: "6px 14px",
              borderRadius: 99,
              border: `1.5px solid ${cat === "all" ? "var(--blue-500)" : "var(--line)"}`,
              background: cat === "all" ? "var(--pill-info-bg)" : "var(--bg-elev)",
              color: cat === "all" ? "var(--blue-600)" : "var(--ink-3)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            All
          </button>
          {ctxCategories.filter((c) => c.count > 0).map((c) => (
            <button
              key={c.id}
              onClick={() => setParam("cat", c.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 99,
                border: `1.5px solid ${cat === c.id ? "var(--blue-500)" : "var(--line)"}`,
                background: cat === c.id ? "var(--pill-info-bg)" : "var(--bg-elev)",
                color: cat === c.id ? "var(--blue-600)" : "var(--ink-3)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Sort select */}
        <select
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1.5px solid var(--line)",
            background: "var(--bg-elev)",
            color: "var(--ink-2)",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            outline: "none",
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Results ── */}
      {loading ? (
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
      ) : fetched && results.length === 0 ? (
        /* ── Empty state ── */
        <div style={{ padding: "48px 0", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>
            No results found{q ? ` for "${q}"` : ""}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-4)", marginBottom: 20 }}>
            Try a different search term or browse a category
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {POPULAR.map((term) => (
              <button
                key={term}
                onClick={() => navigate({ to: "/search", search: { q: term, cat: "all", sort: "relevance", page: 1 } })}
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--bg-elev)",
                  borderRadius: 99,
                  padding: "7px 14px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink-2)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(auto-fill, minmax(190px, 1fr))",
              gap: isMobile ? 8 : 12,
            }}
          >
            {results.map((p) => (
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

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 24,
                flexWrap: "wrap",
              }}
            >
              <button
                disabled={page <= 1}
                onClick={() => setParam("page", page - 1)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "1.5px solid var(--line)",
                  background: "var(--bg-elev)",
                  color: page <= 1 ? "var(--ink-4)" : "var(--ink)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: page <= 1 ? "default" : "pointer",
                  fontFamily: "inherit",
                  opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: "var(--ink-4)", fontWeight: 500 }}>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setParam("page", page + 1)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "1.5px solid var(--line)",
                  background: "var(--bg-elev)",
                  color: page >= totalPages ? "var(--ink-4)" : "var(--ink)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: page >= totalPages ? "default" : "pointer",
                  fontFamily: "inherit",
                  opacity: page >= totalPages ? 0.5 : 1,
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
