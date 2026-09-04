import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CATEGORIES,
  CURATED_TAGS,
  PKR,
  getSelectableOptions,
  getUnitPrice,
  normalizeVariantOptions,
  FREE_SHIPPING_THRESHOLD,
  type Product,
} from "./data";
import { Icons } from "./icons";
import { ProductImage, ProductPhoto, Pill, Btn, Section } from "./ui";
import { useWcm, useTestimonials } from "./context";
import type { CartLine, Testimonial } from "./context";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  CategoryRail,
  DealsRail,
  ProductCard,
  ProductCardSkeleton,
  RecentlyViewedRail,
} from "./products-card-components";
import { Hero, TrustRibbon } from "./products-marketing-components";
import {
  PRODUCTS_PAGE_SIZE,
  SORT_OPTIONS,
  SortDropdown,
  getVisiblePaginationItems,
  paginationBtnStyle,
  paginationEllipsisStyle,
} from "./products-filter-components";

const RECENTLY_VIEWED_KEY = "wcm_recently_viewed";
const RECENTLY_VIEWED_MAX = 12;
const HOMEPAGE_TOP_CATEGORIES_MOBILE = 10;
// Show 15 categories: 8 in row 1, 7 in row 2 + view-all button
const HOMEPAGE_TOP_CATEGORIES_DESKTOP = 15;

// Small play-triangle overlay for video thumbnails — browsers already render
// a video element's first frame as its poster, this just signals it's a
// clip rather than a photo.
function PlayBadge() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: "5px solid transparent",
            borderBottom: "5px solid transparent",
            borderLeft: "8px solid #fff",
            marginLeft: 2,
          }}
        />
      </div>
    </div>
  );
}

function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });

  const trackView = useCallback((id: string) => {
    setIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENTLY_VIEWED_MAX);
      try {
        localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return { ids, trackView };
}

export function ProductsPage({
  addToCart,
  openProduct,
  cart,
  goTo,
  category,
  onCategoryChange,
  page: pageParam,
  onPageChange,
}: {
  addToCart: (p: Product) => void;
  openProduct: (p: Product) => void;
  cart: CartLine[];
  goTo: (p: "products" | "orders") => void;
  category?: string;
  onCategoryChange?: (cat: string) => void;
  page?: number;
  onPageChange?: (page: number) => void;
}) {
  const { products, productsLoaded, categories, categoriesLoaded } = useWcm();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { ids: recentlyViewedIds } = useRecentlyViewed();
  const [active, setActive] = useState(category ?? "all");
  const [sort, setSort] = useState("popular");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileDraftActive, setMobileDraftActive] = useState(category ?? "all");
  const [mobileDraftSort, setMobileDraftSort] = useState("popular");
  const [mobileDraftInStockOnly, setMobileDraftInStockOnly] = useState(false);
  const [page, setPageInternal] = useState(pageParam ?? 1);
  const [gridKey, setGridKey] = useState(0);
  const listingTopRef = useRef<HTMLDivElement | null>(null);
  const productsTopRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToProductsRef = useRef(false);
  const hasMountedPaginationRef = useRef(false);
  const prevFiltersRef = useRef({ active, sort, inStockOnly });

  const setPage = useCallback(
    (next: number) => {
      setPageInternal(next);
      onPageChange?.(next);
    },
    [onPageChange],
  );

  // Sync active category when URL param changes (e.g. browser back/forward)
  useEffect(() => {
    setActive(category ?? "all");
  }, [category]);

  // Sync page when URL param changes (e.g. browser back/forward)
  useEffect(() => {
    setPageInternal(pageParam ?? 1);
  }, [pageParam]);

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    setMobileDraftActive(active);
    setMobileDraftSort(sort);
    setMobileDraftInStockOnly(inStockOnly);
  }, [mobileFiltersOpen, active, sort, inStockOnly]);

  const filtered = useMemo(() => {
    let arr: Product[] = products;
    if (active !== "all") arr = arr.filter((p) => p.cat === active);
    if (inStockOnly) arr = arr.filter((p) => p.stock !== "Out of stock");
    if (sort === "popular")
      arr = [...arr].sort((a, b) => (b.delivered_sales_count ?? 0) - (a.delivered_sales_count ?? 0));
    if (sort === "low") arr = [...arr].sort((a, b) => a.price - b.price);
    if (sort === "high") arr = [...arr].sort((a, b) => b.price - a.price);
    if (sort === "rating") arr = [...arr].sort((a, b) => b.rating - a.rating);
    return arr;
  }, [active, sort, inStockOnly, products]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PAGE_SIZE));
  const pageStart = (page - 1) * PRODUCTS_PAGE_SIZE;
  const pageProducts = filtered.slice(pageStart, pageStart + PRODUCTS_PAGE_SIZE);
  const visiblePaginationItems = useMemo(
    () => getVisiblePaginationItems(page, totalPages),
    [page, totalPages],
  );

  useEffect(() => {
    const prev = prevFiltersRef.current;
    const changed = prev.active !== active || prev.sort !== sort || prev.inStockOnly !== inStockOnly;
    prevFiltersRef.current = { active, sort, inStockOnly };
    if (changed) setPage(1);
  }, [active, sort, inStockOnly]);

  useEffect(() => {
    if (!productsLoaded) return;
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, productsLoaded]);

  useEffect(() => {
    if (!productsLoaded) return;
    if (!hasMountedPaginationRef.current) {
      hasMountedPaginationRef.current = true;
      return;
    }
    productsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page, productsLoaded]);

  useEffect(() => {
    if (!productsLoaded) return;
    if (!shouldScrollToProductsRef.current) return;
    shouldScrollToProductsRef.current = false;
    productsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active, productsLoaded]);

  const cartQtyById = useMemo(() => {
    const qtyById = new Map<string, number>();
    for (const line of cart) {
      qtyById.set(line.id, (qtyById.get(line.id) || 0) + line.qty);
    }
    return qtyById;
  }, [cart]);
  const storefrontCategories = useMemo(() => {
    const source = categoriesLoaded && categories.length > 0 ? categories : CATEGORIES;
    const counts = products.reduce<Record<string, number>>((acc, product) => {
      acc[product.cat] = (acc[product.cat] || 0) + 1;
      return acc;
    }, {});

    const normalized = source.map((cat) => {
      if (cat.id === "all") {
        return { ...cat, count: products.length };
      }
      return { ...cat, count: counts[cat.id] || 0 };
    });

    if (!normalized.some((cat) => cat.id === "all")) {
      normalized.unshift({ id: "all", name: "All products", count: products.length });
    }

    return normalized;
  }, [categories, categoriesLoaded, products]);

  const homepageCategories = useMemo(() => {
    const nonAllCategories = storefrontCategories.filter((cat) => cat.id !== "all");
    const flaggedCategories = nonAllCategories.filter((cat) => cat.top_category);
    const rankedByCount = [...nonAllCategories].sort((a, b) => (b.count || 0) - (a.count || 0));

    const rankedCategories =
      flaggedCategories.length > 0
        ? [...flaggedCategories, ...rankedByCount.filter((cat) => !cat.top_category)]
        : rankedByCount;

    const homepageOrder = [
      "glucometers",
      "bp-digital",
      "weight-scale",
      "nebulizer",
      "camote-chairs",
      "walkers",
      "patient-sticks",
      "wheelchairs",
      "massagers",
      "air-mattress",
      "heating-pad",
      "sugar-strips",
      "orthobelts-supports",
      "other",
    ];

    const orderedCategories = [...rankedCategories].sort((a, b) => {
      const aIndex = homepageOrder.indexOf(a.id);
      const bIndex = homepageOrder.indexOf(b.id);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    if (isMobile) {
      const mobileVisible = orderedCategories.slice(0, HOMEPAGE_TOP_CATEGORIES_MOBILE);
      const activeCategory = nonAllCategories.find((cat) => cat.id === active);
      const hasActive =
        !!activeCategory && mobileVisible.some((category) => category.id === activeCategory.id);

      if (activeCategory && activeCategory.id !== "all" && !hasActive && mobileVisible.length > 0) {
        mobileVisible[mobileVisible.length - 1] = activeCategory;
      }

      return mobileVisible;
    }

    return orderedCategories.slice(0, HOMEPAGE_TOP_CATEGORIES_DESKTOP);
  }, [storefrontCategories, isMobile, active]);

  const hasRecentlyViewed = useMemo(() => {
    if (!recentlyViewedIds.length) return false;
    const productIds = new Set(products.map((product) => product.id));
    return recentlyViewedIds.some((id) => productIds.has(id));
  }, [recentlyViewedIds, products]);

  const hasActiveFilters = active !== "all" || inStockOnly || sort !== "popular";
  const activeFilterCount =
    (active !== "all" ? 1 : 0) + (inStockOnly ? 1 : 0) + (sort !== "popular" ? 1 : 0);

  const clearAllFilters = () => {
    shouldScrollToProductsRef.current = true;
    setActive("all");
    setInStockOnly(false);
    setSort("popular");
    setGridKey((k) => k + 1);
    onCategoryChange?.("all");
  };

  const applyMobileFilters = () => {
    const nextActive = mobileDraftActive;
    const nextSort = mobileDraftSort;
    const nextInStockOnly = mobileDraftInStockOnly;

    const changed = nextActive !== active || nextSort !== sort || nextInStockOnly !== inStockOnly;

    if (changed) {
      shouldScrollToProductsRef.current = true;
      setActive(nextActive);
      setSort(nextSort);
      setInStockOnly(nextInStockOnly);
      setGridKey((k) => k + 1);
      if (nextActive !== active) {
        onCategoryChange?.(nextActive);
      }
    }

    setMobileFiltersOpen(false);
  };

  return (
    <div>
      <Hero goTo={goTo} />
      <TrustRibbon />
      {!productsLoaded && (
        <div style={{ height: isMobile ? 258 : 305, minWidth: 0 }} aria-hidden="true" />
      )}
      <DealsRail
        products={products}
        cart={cart}
        onAdd={addToCart}
        onOpen={openProduct}
        isMobile={isMobile}
      />
      <RecentlyViewedRail
        ids={recentlyViewedIds}
        products={products}
        cart={cart}
        onAdd={addToCart}
        onOpen={openProduct}
        isMobile={isMobile}
      />
      {hasRecentlyViewed ? <div className="wcm-section-divider" /> : null}
      <div ref={listingTopRef} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 6 }}>
        {hasActiveFilters && (
          <div className="wcm-active-filters">
            <span className="wcm-active-filters-label">Active filters</span>
            {active !== "all" && (
              <button
                className="wcm-filter-chip"
                onClick={() => {
                  shouldScrollToProductsRef.current = true;
                  setActive("all");
                  setGridKey((k) => k + 1);
                  onCategoryChange?.("all");
                }}
              >
                Category: {storefrontCategories.find((cat) => cat.id === active)?.name || active}
                <span aria-hidden="true">{Icons.close}</span>
              </button>
            )}
            {inStockOnly && (
              <button
                className="wcm-filter-chip"
                onClick={() => {
                  setInStockOnly(false);
                  setGridKey((k) => k + 1);
                }}
              >
                In stock only <span aria-hidden="true">{Icons.close}</span>
              </button>
            )}
            {sort !== "popular" && (
              <button
                className="wcm-filter-chip"
                onClick={() => {
                  setSort("popular");
                  setGridKey((k) => k + 1);
                }}
              >
                {SORT_OPTIONS.find((opt) => opt.value === sort)?.label || "Sorted"}
                <span aria-hidden="true">{Icons.close}</span>
              </button>
            )}
            <button className="wcm-clear-filters" onClick={clearAllFilters}>
              Clear all
            </button>
          </div>
        )}
        {/* Row 1: Category filter chips */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            paddingInline: 2,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: "var(--ink-4)",
            }}
          >
            Categories
          </div>
        </div>
        <CategoryRail
          categories={homepageCategories}
          isMobile={isMobile}
          onViewAll={() => navigate({ to: "/categories" })}
          active={active}
          setActive={(v) => navigate({ to: "/categories/$categoryId", params: { categoryId: v } })}
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
          {isMobile && (
            <button
              className="wcm-mobile-filter-btn"
              onClick={() => setMobileFiltersOpen(true)}
              style={{ marginRight: "auto" }}
            >
              {Icons.filter} Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
            </button>
          )}
          <span style={{ fontSize: 13, color: "var(--ink-4)", fontWeight: 600 }}>
            {!productsLoaded ? (
              <span
                style={{
                  display: "inline-block",
                  width: 80,
                  height: 14,
                  borderRadius: 6,
                  background: "var(--chip)",
                  animation: "wcmPulse 1.4s ease infinite",
                }}
              />
            ) : (
              <>
                Showing {filtered.length === 0 ? 0 : pageStart + 1}–
                {Math.min(pageStart + PRODUCTS_PAGE_SIZE, filtered.length)} of {filtered.length}
              </>
            )}
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

      {isMobile && mobileFiltersOpen && (
        <div
          className="wcm-filter-sheet-overlay"
          onClick={() => setMobileFiltersOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMobileFiltersOpen(false);
          }}
        >
          <div className="wcm-filter-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="wcm-filter-sheet-head">
              <div style={{ fontWeight: 800, fontSize: 16 }}>Filters</div>
              <button
                className="wcm-filter-sheet-close"
                onClick={() => setMobileFiltersOpen(false)}
              >
                {Icons.close}
              </button>
            </div>

            <div className="wcm-filter-sheet-group">
              <div className="wcm-filter-sheet-label">Category</div>
              <div className="wcm-filter-sheet-chip-wrap">
                {storefrontCategories.map((cat) => {
                  const on = cat.id === mobileDraftActive;
                  return (
                    <button
                      key={`sheet-${cat.id}`}
                      className="wcm-filter-sheet-chip"
                      data-active={on ? "true" : "false"}
                      onClick={() => setMobileDraftActive(cat.id)}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="wcm-filter-sheet-group">
              <div className="wcm-filter-sheet-label">Stock</div>
              <label className="wcm-filter-sheet-check">
                <input
                  type="checkbox"
                  checked={mobileDraftInStockOnly}
                  onChange={(e) => setMobileDraftInStockOnly(e.target.checked)}
                />
                In stock only
              </label>
            </div>

            <div className="wcm-filter-sheet-group">
              <div className="wcm-filter-sheet-label">Sort by</div>
              <div className="wcm-filter-sheet-chip-wrap">
                {SORT_OPTIONS.map((opt) => {
                  const on = opt.value === mobileDraftSort;
                  return (
                    <button
                      key={`sort-${opt.value}`}
                      className="wcm-filter-sheet-chip"
                      data-active={on ? "true" : "false"}
                      onClick={() => setMobileDraftSort(opt.value)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="wcm-filter-sheet-actions">
              <button
                className="wcm-filter-sheet-secondary"
                onClick={() => {
                  setMobileDraftActive("all");
                  setMobileDraftInStockOnly(false);
                  setMobileDraftSort("popular");
                }}
              >
                Clear all
              </button>
              <button className="wcm-filter-sheet-primary" onClick={applyMobileFilters}>
                Apply filters
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={productsTopRef} className="wcm-scroll-anchor" />
      {(() => {
        const cartSubtotal = cart.reduce((s, c) => {
          const p = products.find((pr) => pr.id === c.id);
          return p ? s + getUnitPrice(p, c.size) * c.qty : s;
        }, 0);
        if (cartSubtotal <= 0 || cartSubtotal >= FREE_SHIPPING_THRESHOLD) return null;
        return (
          <div
            style={{
              marginBottom: 14,
              padding: "9px 12px",
              background: "var(--surface)",
              borderRadius: 10,
              border: "1px solid var(--line)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-2)",
                marginBottom: 5,
              }}
            >
              <span>
                Add {PKR(FREE_SHIPPING_THRESHOLD - cartSubtotal)} more for free delivery in Karachi
              </span>
              <span style={{ color: "var(--ink-4)" }}>
                {Math.round((cartSubtotal / FREE_SHIPPING_THRESHOLD) * 100)}%
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: "var(--line)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.round((cartSubtotal / FREE_SHIPPING_THRESHOLD) * 100)}%`,
                  background: "var(--grad)",
                  borderRadius: 999,
                  transition: "width .4s ease",
                }}
              />
            </div>
          </div>
        );
      })()}

      {!productsLoaded ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(auto-fill, minmax(190px, 1fr))",
            gap: isMobile ? 8 : 12,
          }}
        >
          {Array.from({ length: PRODUCTS_PAGE_SIZE }).map((_, i) => (
            <ProductCardSkeleton key={i} isMobile={isMobile} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Section
          key={gridKey}
          style={{ padding: 32, textAlign: "center", animation: "fadeInUp 0.25s ease" }}
        >
          <div className="wcm-empty-icon" role="img" aria-label="Search">
            🔎
          </div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Nothing matches right now</div>
          <div style={{ color: "var(--ink-4)", fontSize: 13, marginTop: 6 }}>
            Clear filters or try one of our fast-moving collections.
          </div>
          <div className="wcm-empty-actions">
            <Btn
              variant="outline"
              icon={Icons.refresh}
              onClick={() => {
                shouldScrollToProductsRef.current = true;
                setActive("all");
                setSort("popular");
                setInStockOnly(false);
                setGridKey((k) => k + 1);
                onCategoryChange?.("all");
              }}
            >
              Reset filters
            </Btn>
            <Btn variant="solid" icon={Icons.sparkle} onClick={() => setSort("rating")}>
              Show top rated
            </Btn>
          </div>
          <div className="wcm-empty-suggestions">
            {storefrontCategories
              .filter((cat) => cat.id !== "all" && (cat.count || 0) > 0)
              .sort((a, b) => (b.count || 0) - (a.count || 0))
              .slice(0, 4)
              .map((cat) => (
                <button
                  key={`empty-${cat.id}`}
                  className="wcm-empty-suggestion-chip"
                  onClick={() => {
                    shouldScrollToProductsRef.current = true;
                    setActive(cat.id);
                    setGridKey((k) => k + 1);
                    onCategoryChange?.(cat.id);
                  }}
                >
                  {cat.name}
                </button>
              ))}
          </div>
        </Section>
      ) : (
        <div
          key={gridKey}
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(auto-fill, minmax(190px, 1fr))",
            gap: isMobile ? 8 : 12,
            animation: "fadeInUp 0.25s ease",
          }}
        >
          {pageProducts.map((p) => (
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
      )}

      {productsLoaded && filtered.length > 0 && totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 18,
          }}
        >
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            style={{
              ...paginationBtnStyle,
              opacity: page === 1 ? 0.5 : 1,
              cursor: page === 1 ? "default" : "pointer",
            }}
          >
            Previous
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {visiblePaginationItems.map((item, index) => {
              if (item === "ellipsis") {
                return (
                  <span key={`ellipsis-${index}`} style={paginationEllipsisStyle}>
                    ...
                  </span>
                );
              }

              const activePage = item === page;
              return (
                <button
                  key={item}
                  onClick={() => setPage(item)}
                  style={{
                    ...paginationBtnStyle,
                    minWidth: 40,
                    background: activePage ? "var(--ink)" : "var(--card)",
                    color: activePage ? "var(--card)" : "var(--ink-2)",
                    borderColor: activePage ? "var(--ink)" : "var(--line)",
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            style={{
              ...paginationBtnStyle,
              opacity: page === totalPages ? 0.5 : 1,
              cursor: page === totalPages ? "default" : "pointer",
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

const qtyBtn: React.CSSProperties = {
  width: 42,
  height: 42,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--card)",
  border: "none",
  color: "var(--ink-2)",
  cursor: "pointer",
};

// Row of small filled/outline stars for one person's actual rating — the
// shared `Stars` component (single icon + decimal, e.g. "★ 4.5") is built
// for a computed average and reads oddly applied to one review's whole-
// number score (a customer didn't give "5.0 stars", they gave 5).
function ReviewStars({ rating, size = 13 }: { rating: number; size?: number }) {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span style={{ color: "#f59e0b", fontSize: size, letterSpacing: 1 }} aria-label={`${r} out of 5 stars`}>
      {"★".repeat(r)}
      <span style={{ color: "var(--line)" }}>{"★".repeat(5 - r)}</span>
    </span>
  );
}

function testimonialAccent(source: string): string {
  return source === "facebook" ? "#1877f2" : source === "daraz" ? "#f85a02" : "var(--ink-4)";
}

// Initials avatar — these are curated from screenshots, not a real profile
// photo we're allowed to host, so a plain neutral initial stands in instead
// of faking one. Kept source-neutral (not tinted per platform) — the left
// border stripe is the only per-source color accent on the card now.
function ReviewerAvatar({ name, size = 38 }: { name: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--bg-elev)",
        border: "1.5px solid var(--line)",
        color: "var(--ink-3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.42,
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      {initial}
    </div>
  );
}

// display_order first (nulls last), then review_date/created_at, newest
// first — same fallback chain the admin app's spec calls for.
function sortTestimonials(items: Testimonial[]): Testimonial[] {
  return [...items].sort((a, b) => {
    if (a.display_order != null && b.display_order != null && a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    if (a.display_order != null && b.display_order == null) return -1;
    if (a.display_order == null && b.display_order != null) return 1;
    const aTime = new Date(a.review_date ?? a.created_at).getTime();
    const bTime = new Date(b.review_date ?? b.created_at).getTime();
    return bTime - aTime;
  });
}

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Manually-curated Facebook/Daraz reviews, shown as a site-wide social-proof
// timeline — every published testimonial, on every product page, NOT
// filtered to the product being viewed (that's a deliberate pivot from a
// per-product "Customer Reviews" section: with only a handful of curated
// reviews total, scoping to one exact product left most PDPs with nothing
// to show; framed as general testimonials instead of per-product reviews,
// showing the full pool everywhere is honest rather than misleading).
// Independent from the sold-count pill above (real order/Daraz sales
// counters) and from the dormant usePublicProductReviews/order_reviews
// system (real, order-linked reviews, not wired into the PDP by design —
// see useTestimonials's own comment). Hides itself entirely when there's
// nothing published, same "no fake empty state" rule the sold-count pill
// already follows.
function TestimonialsSection() {
  const { testimonials, loading } = useTestimonials();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const isMobile = useIsMobile();

  if (loading || testimonials.length === 0) return null;

  const sorted = sortTestimonials(testimonials);
  const cardWidth = isMobile ? 272 : 320;

  return (
    <Section className="wcm-detail-reviews" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 18, margin: 0, fontWeight: 800, letterSpacing: -0.2 }}>Satisfied customers</h2>
        <span style={{ fontSize: 12, color: "var(--ink-4)" }}>What customers are saying on Facebook</span>
      </div>

      <div
        className="wcm-testimonial-rail"
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 12,
          width: "100%",
          minWidth: 0,
          maxWidth: "100%",
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorX: "contain",
          touchAction: "pan-x pan-y",
          scrollSnapType: "x mandatory",
          paddingBottom: 6,
          scrollbarWidth: "none",
        }}
      >
        <style>{`.wcm-testimonial-rail::-webkit-scrollbar{display:none}`}</style>
        {sorted.map((t) => {
          const accent = testimonialAccent(t.source);
          return (
            <div
              key={t.id}
              style={{
                flex: `0 0 ${cardWidth}px`,
                width: cardWidth,
                scrollSnapAlign: "start",
                borderTop: "1px solid var(--line)",
                borderRight: "1px solid var(--line)",
                borderBottom: "1px solid var(--line)",
                borderLeft: `6px solid ${accent}`,
                padding: 10,
                background: "var(--card)",
                boxShadow: "var(--shadow-sm)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <ReviewerAvatar name={t.reviewer_name} size={26} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    By {t.reviewer_name}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{formatReviewDate(t.review_date ?? t.created_at)}</div>
                </div>
              </div>

              {t.rating != null && (
                <div style={{ marginTop: 6 }}>
                  <ReviewStars rating={t.rating} size={13} />
                </div>
              )}

              {t.review_text && (
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: 13,
                    lineHeight: 1.4,
                    color: "var(--ink-2)",
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {t.review_text}
                </p>
              )}

              {t.screenshot_url && (
                <button
                  type="button"
                  onClick={() => setLightbox(t.screenshot_url)}
                  style={{ marginTop: 5, padding: 0, border: "none", background: "none", cursor: "zoom-in", alignSelf: "flex-start" }}
                >
                  <img
                    src={t.screenshot_url}
                    alt={`${t.reviewer_name}'s review screenshot`}
                    style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)", display: "block" }}
                  />
                </button>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto", paddingTop: 6, flexWrap: "wrap" }}>
                {t.source_url && (
                  <a
                    href={t.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 0",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--ink-2)",
                      textDecoration: "underline",
                      textUnderlineOffset: 2,
                      whiteSpace: "nowrap",
                    }}
                  >
                    View on {t.source === "facebook" ? "Facebook" : "Daraz"}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", maxWidth: 560, width: "100%", maxHeight: "85vh", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 16, overflow: "auto" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 10 }}>
              <button
                onClick={() => setLightbox(null)}
                aria-label="Close review screenshot"
                style={{ border: "none", background: "transparent", color: "var(--ink-4)", cursor: "pointer" }}
              >
                {Icons.close}
              </button>
            </div>
            <img src={lightbox} alt="Review screenshot" style={{ width: "100%", height: "auto", borderRadius: 10, display: "block" }} />
          </div>
        </div>
      )}
    </Section>
  );
}

export function ProductDetail({
  product,
  onClose,
  addToCart,
  cart,
  openProduct,
}: {
  product: Product;
  onClose: () => void;
  addToCart: (p: Product, qty?: number, size?: string) => void;
  cart: CartLine[];
  openProduct: (p: Product) => void;
}) {
  const { products, productsLoaded, categories, categoriesLoaded, wishlist, toggleWishlist } =
    useWcm();
  const isMobile = useIsMobile();
  const { trackView } = useRecentlyViewed();
  const [qty, setQty] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<"Child" | "Adult" | null>(null);
  const [selectedFit, setSelectedFit] = useState<"Adjustable" | "Medium" | null>(null);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const isOrthoBelt =
    product.cat === "ortho-belts" && product.id !== "belt-003" && product.id !== "belt-004";
  const isPolysling = product.id === "belt-004";
  const isAbdominalBelt = product.id === "belt-003";

  const variantOptions = normalizeVariantOptions(product.variant_options);
  const selectableOptions = getSelectableOptions(product);
  const hasSelectableOptions = selectableOptions.length > 0;
  const hasVariantPricing = variantOptions.length > 0;
  const optionLabel = hasVariantPricing ? "Variant" : "Size";
  const variantKey =
    [selectedAgeGroup, selectedFit, selectedSize].filter(Boolean).join(" / ") || undefined;
  const resolvedUnitPrice = getUnitPrice(product, selectedSize || undefined);

  // Track this product as recently viewed
  useEffect(() => {
    trackView(product.id);
  }, [product.id, trackView]);
  const [activeView, setActiveView] = useState(0);
  const touchStartX = useRef<number | null>(null);
  // Live finger-tracking for the hero swipe — touchStartX above only ever
  // fed a release-time delta (see the old onTouchStart/onTouchEnd pair),
  // so the image jumped straight to the next one with no motion following
  // the finger during the drag itself. dragX is the raw px the finger has
  // moved since touchstart; heroTrackWidth is the hero's own measured
  // width (remeasured each touchstart) used to convert that into a
  // translateX offset. settling holds which way a released drag is
  // animating to ("next"/"prev" commit it, "cancel" springs back) — null
  // means "not currently mid-drag or mid-settle", i.e. resting at rest position.
  const [dragX, setDragX] = useState(0);
  const [settling, setSettling] = useState<"next" | "prev" | "cancel" | null>(null);
  // A ref for synchronous reads inside the touch handlers (no waiting on a
  // render), mirrored into heroWidth state purely so the resting position —
  // computed at render time, before any touch has happened — has a non-zero
  // width to base itself on instead of defaulting to 0.
  const heroTrackWidth = useRef(0);
  const [heroWidth, setHeroWidth] = useState(0);
  const heroContainerRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const dragAxis = useRef<"x" | "y" | null>(null);

  useEffect(() => {
    const el = heroContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      heroTrackWidth.current = w;
      setHeroWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  // Starts muted — browsers block autoplay-with-sound otherwise — the
  // speaker button lets the shopper opt in to audio afterward, which
  // counts as a user gesture so unmuting is always allowed.
  const [heroVideoMuted, setHeroVideoMuted] = useState(true);
  const inCart = cart.find((c) => c.id === product.id && (!variantKey || c.size === variantKey));
  const isSaved = wishlist.includes(product.id);
  const cat =
    (categoriesLoaded ? categories : CATEGORIES).find((c) => c.id === product.cat)?.name ||
    product.category_name ||
    product.cat;
  const related = (() => {
    const others = products.filter((p: Product) => p.id !== product.id);
    const GENERIC_BRANDS = new Set(["imported"]);
    const brandKey = (product.brand || "").trim().toLowerCase();
    const hasRealBrand = brandKey.length > 0 && !GENERIC_BRANDS.has(brandKey);
    const sameBrand = hasRealBrand
      ? others.filter((p: Product) => (p.brand || "").trim().toLowerCase() === brandKey)
      : [];
    const sameBrandIds = new Set(sameBrand.map((p) => p.id));
    const sameCat = others.filter(
      (p: Product) => p.cat === product.cat && !sameBrandIds.has(p.id)
    );
    return [...sameBrand, ...sameCat].slice(0, 8);
  })();
  const detailMedia = useMemo(() => {
    const primary = product.image_url ? [product.image_url] : [];
    const extra = Array.isArray(product.gallery_images) ? product.gallery_images : [];
    const images = Array.from(new Set([...primary, ...extra].filter((src): src is string => Boolean(src))));
    const videos = Array.isArray(product.gallery_videos)
      ? product.gallery_videos.filter((src): src is string => Boolean(src))
      : [];
    // Main image first, then video(s), then the rest of the gallery — a demo
    // video is worth surfacing right after the hero shot rather than buried
    // behind every gallery photo, which is where a plain images-then-videos
    // concat would otherwise put it.
    const [mainImage, ...restImages] = images;
    return [
      ...(mainImage ? [{ type: "image" as const, src: mainImage }] : []),
      ...videos.map((src) => ({ type: "video" as const, src })),
      ...restImages.map((src) => ({ type: "image" as const, src })),
    ];
  }, [product]);
  const hasMultipleImages = detailMedia.length > 1;
  const activeMedia = detailMedia[activeView] ?? detailMedia[0] ?? null;
  const thumbIndexes = detailMedia.map((_, i) => i);
  // Neighbors for the drag track's peek panels — wrap around like cycleView
  // already does, so dragging past either end of the gallery still shows
  // something instead of a blank panel.
  const prevMedia = hasMultipleImages
    ? detailMedia[(activeView - 1 + detailMedia.length) % detailMedia.length]
    : null;
  const nextMedia = hasMultipleImages ? detailMedia[(activeView + 1) % detailMedia.length] : null;

  useEffect(() => {
    setActiveView(0);
  }, [product.id, detailMedia.length]);

  useEffect(() => {
    setHeroVideoMuted(true);
  }, [product.id]);

  useEffect(() => {
    if (!hasSelectableOptions) {
      if (!isOrthoBelt) setSelectedSize(null);
      return;
    }
    if (!selectedSize || !selectableOptions.some((option) => option.label === selectedSize)) {
      setSelectedSize(selectableOptions[0].label);
    }
  }, [hasSelectableOptions, isOrthoBelt, selectedSize, selectableOptions]);

  const cycleView = (dir: 1 | -1) => {
    if (detailMedia.length <= 1) return;
    setActiveView((v) => (v + dir + detailMedia.length) % detailMedia.length);
  };

  const heroTouchStart = (e: React.TouchEvent) => {
    if (!hasMultipleImages) return;
    const t = e.touches[0];
    if (!t) return;
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    dragAxis.current = null;
    setSettling(null);
    heroTrackWidth.current = e.currentTarget.getBoundingClientRect().width;
  };

  const heroTouchMove = (e: React.TouchEvent) => {
    if (!hasMultipleImages || touchStartX.current == null) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - (touchStartY.current ?? t.clientY);
    if (dragAxis.current == null) {
      // Deadzone before committing to an axis — a mostly-vertical move
      // means the shopper is scrolling the page, not swiping the gallery,
      // so bail out and let that scroll happen natively.
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      dragAxis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (dragAxis.current !== "x") return;
    setDragX(dx);
  };

  const heroTouchEnd = () => {
    if (!hasMultipleImages || dragAxis.current !== "x") {
      touchStartX.current = null;
      touchStartY.current = null;
      dragAxis.current = null;
      setDragX(0);
      return;
    }
    const width = heroTrackWidth.current || 1;
    const threshold = Math.min(60, width * 0.18);
    const outcome: "next" | "prev" | "cancel" =
      dragX <= -threshold ? "next" : dragX >= threshold ? "prev" : "cancel";
    touchStartX.current = null;
    touchStartY.current = null;
    dragAxis.current = null;
    // A reduced-motion viewer never gets the transition, so the
    // `transitionend` handoff below would never fire and settling would
    // stay stuck — resolve synchronously instead of animating.
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      if (outcome === "next") cycleView(1);
      else if (outcome === "prev") cycleView(-1);
      setDragX(0);
      return;
    }
    setSettling(outcome);
  };

  // Fires once the settle animation below finishes moving the track fully
  // onto the neighboring panel — only then do we actually advance
  // activeView + snap dragX/settling back to their rest values, both in
  // the same render so the track's transform and its underlying slide data
  // shift at once (no visible jump — see the transform calc below).
  const handleHeroSettled = (e: React.TransitionEvent) => {
    if (e.propertyName !== "transform") return;
    if (settling === "next") cycleView(1);
    else if (settling === "prev") cycleView(-1);
    setSettling(null);
    setDragX(0);
  };

  const heroTrackOffset = (() => {
    const width = heroWidth;
    if (settling === "next") return -2 * width;
    if (settling === "prev") return 0;
    if (settling === "cancel") return -width;
    return -width + dragX;
  })();

  // One panel of the swipe track — used for the prev/current/next slots.
  // Only the active panel actually autoplays its video (with the mute/
  // fullscreen controls) — a peeking neighbor just shows the video's own
  // poster frame (`preload="metadata"`, no autoPlay), so a swipe never has
  // two videos playing/loading at once.
  const renderHeroPanel = (media: { type: "image" | "video"; src: string } | null, isActive: boolean) => {
    if (!media) return null;
    if (media.type === "video") {
      return (
        <>
          <video
            key={media.src}
            ref={isActive ? heroVideoRef : undefined}
            src={media.src}
            autoPlay={isActive}
            muted={isActive ? heroVideoMuted : true}
            loop
            playsInline
            preload={isActive ? "auto" : "metadata"}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--bg-elev)",
              objectFit: "contain",
            }}
          />
          {isActive && (
            <div style={{ position: "absolute", bottom: 12, right: 12, display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setHeroVideoMuted((m) => !m)}
                aria-label={heroVideoMuted ? "Unmute video" : "Mute video"}
                title={heroVideoMuted ? "Unmute" : "Mute"}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: "none",
                  background: "rgba(0,0,0,0.55)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {heroVideoMuted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" strokeLinecap="round" />
                    <line x1="17" y1="9" x2="23" y2="15" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => heroVideoRef.current?.requestFullscreen()}
                aria-label="View video fullscreen"
                title="Fullscreen"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: "none",
                  background: "rgba(0,0,0,0.55)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </>
      );
    }
    return (
      <ProductPhoto
        key={media.src}
        src={media.src}
        alt={product.name}
        loading={isActive ? "eager" : "lazy"}
        containerStyle={{
          width: "100%",
          height: "100%",
          borderRadius: 12,
          border: "1px solid var(--line)",
          background: "var(--bg-elev)",
        }}
        imgStyle={{ objectPosition: "center center" }}
      />
    );
  };
  return (
    <div className="wcm-pdp-wrap" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <button
        className="wcm-pdp-back"
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
      <TrustRibbon compact />
      <div className="wcm-detail-cols" style={{ alignItems: "start" }}>
        <Section className="wcm-detail-media" style={{ padding: 18 }}>
          <div
            className="wcm-detail-media-hero"
            ref={heroContainerRef}
            style={{ position: "relative", touchAction: "pan-y" }}
            onTouchStart={heroTouchStart}
            onTouchMove={heroTouchMove}
            onTouchEnd={heroTouchEnd}
          >
            <button
              type="button"
              className="wcm-pdp-overlay-back"
              onClick={onClose}
              aria-label="Back to products"
              style={{
                display: "none",
                position: "absolute",
                top: 14,
                left: 14,
                zIndex: 3,
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "none",
                background: "rgba(15,23,42,.42)",
                backdropFilter: "blur(3px)",
                color: "#fff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {Icons.chevL}
            </button>
            <button
              type="button"
              className="wcm-pdp-overlay-fav"
              onClick={() => toggleWishlist(product.id)}
              aria-label={isSaved ? "Remove from saved" : "Save item"}
              style={{
                display: "none",
                position: "absolute",
                top: 14,
                right: 14,
                zIndex: 3,
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "none",
                background: "rgba(15,23,42,.42)",
                backdropFilter: "blur(3px)",
                color: isSaved ? "#fb7185" : "#fff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill={isSaved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
            {hasMultipleImages && (
              <div
                className="wcm-pdp-overlay-scrim"
                style={{
                  display: "none",
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 84,
                  zIndex: 2,
                  background: "linear-gradient(to top, rgba(15,23,42,.6), transparent)",
                  pointerEvents: "none",
                }}
              />
            )}
            {hasMultipleImages && (
              <div
                className="wcm-pdp-overlay-dots"
                style={{
                  display: "none",
                  position: "absolute",
                  bottom: 22,
                  left: 0,
                  right: 0,
                  zIndex: 3,
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {thumbIndexes.map((i) => (
                  <button
                    key={`dot-${i}`}
                    type="button"
                    onClick={() => setActiveView(i)}
                    aria-label={`Show image ${i + 1}`}
                    style={{
                      width: i === activeView ? 16 : 6,
                      height: 6,
                      borderRadius: 3,
                      border: "1px solid rgba(15,23,42,.35)",
                      padding: 0,
                      background: i === activeView ? "#fff" : "rgba(255,255,255,.8)",
                      boxShadow: "0 1px 2px rgba(15,23,42,.35)",
                      transition: "width .2s ease, background .2s ease",
                    }}
                  />
                ))}
              </div>
            )}
            {activeMedia ? (
              hasMultipleImages ? (
                <div style={{ width: "100%", aspectRatio: "1/1", borderRadius: 12, overflow: "hidden" }}>
                  <div
                    className="wcm-pdp-hero-track"
                    onTransitionEnd={handleHeroSettled}
                    style={{
                      display: "flex",
                      width: "300%",
                      height: "100%",
                      transform: `translateX(${heroTrackOffset}px)`,
                      transition: settling ? "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
                    }}
                  >
                    <div style={{ position: "relative", width: "33.3333%", height: "100%", flexShrink: 0 }}>
                      {renderHeroPanel(prevMedia, false)}
                    </div>
                    <div style={{ position: "relative", width: "33.3333%", height: "100%", flexShrink: 0 }}>
                      {renderHeroPanel(activeMedia, true)}
                    </div>
                    <div style={{ position: "relative", width: "33.3333%", height: "100%", flexShrink: 0 }}>
                      {renderHeroPanel(nextMedia, false)}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ position: "relative", width: "100%", aspectRatio: "1/1" }}>
                  {renderHeroPanel(activeMedia, true)}
                </div>
              )
            ) : (
              <ProductImage product={product} />
            )}
          </div>
          {hasMultipleImages && (
            <div
              className="wcm-detail-thumbs-desktop"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.max(thumbIndexes.length, 4)},1fr)`,
                gap: 8,
                marginTop: 12,
              }}
            >
              {thumbIndexes.map((i) => (
                <button
                  key={i}
                  onClick={() => setActiveView(i)}
                  aria-label={detailMedia[i].type === "video" ? `Play video ${i + 1}` : `Show image ${i + 1}`}
                  style={{
                    position: "relative",
                    aspectRatio: "1/1",
                    borderRadius: 9,
                    border: "1px solid var(--line)",
                    background: `linear-gradient(135deg, var(--bg-elev), var(--chip))`,
                    opacity: i === activeView ? 1 : 0.7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    cursor: "pointer",
                    ...(i === activeView
                      ? {
                          borderColor: "var(--blue-600)",
                          boxShadow: "0 0 0 2px var(--pill-info-bg)",
                        }
                      : {}),
                  }}
                >
                  {detailMedia[i].type === "video" ? (
                    <>
                      <video
                        src={detailMedia[i].src}
                        muted
                        preload="metadata"
                        onLoadedMetadata={(e) => {
                          // 0.1s still lands inside a fade-in on edited
                          // clips (title card fading in from black); 1.5s
                          // reliably clears that without needing per-video
                          // tuning. Browsers clamp the seek for shorter clips.
                          e.currentTarget.currentTime = Math.min(1.5, e.currentTarget.duration / 2 || 1.5);
                        }}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <PlayBadge />
                    </>
                  ) : (
                    <ProductPhoto
                      src={detailMedia[i].src}
                      alt={`${product.name} thumbnail ${i + 1}`}
                      containerStyle={{ width: "100%", height: "100%" }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </Section>
        <div
          className="wcm-detail-info"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div className="wcm-detail-head-block">
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--ink-4)", fontWeight: 600 }}>{cat}</span>
                <span style={{ color: "var(--ink-4)" }}>·</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--blue-700)" }}>
                  {product.brand}
                </span>
                {product.tags
                  .filter((t) => CURATED_TAGS.has(t))
                  .map((t) => (
                    <Pill
                      key={t}
                      tone={t === "Best seller" ? "green" : t === "Top rated" ? "blue" : "rose"}
                    >
                      {t}
                    </Pill>
                  ))}
              </div>
              <button
                className="wcm-pdp-mobile-fav"
                onClick={() => toggleWishlist(product.id)}
                aria-label={isSaved ? "Remove from saved" : "Save item"}
                title={isSaved ? "Remove from saved" : "Save item"}
                style={{
                  width: 34,
                  minWidth: 34,
                  height: 34,
                  borderRadius: 99,
                  border: isSaved ? "1px solid var(--pill-rose-bg)" : "1px solid var(--line)",
                  background: isSaved ? "var(--pill-rose-bg)" : "var(--card)",
                  color: isSaved ? "var(--pill-rose-fg)" : "var(--ink-4)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill={isSaved ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
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
            {(() => {
              const totalSold = (product.delivered_sales_count ?? 0) + (product.daraz_delivered_sales_count ?? 0);
              if (totalSold <= 0) return null;
              return (
                <div style={{ display: "flex", alignItems: "center", marginTop: 6 }}>
                  <Pill tone="green">🔥 {totalSold}+ sold</Pill>
                </div>
              );
            })()}
          </div>
          <Section
            className="wcm-detail-price-card"
            style={{
              padding: 18,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div
                className="wcm-detail-price-row"
                style={{ display: "flex", alignItems: "baseline", gap: 10 }}
              >
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    color: "var(--ink)",
                    letterSpacing: -0.4,
                  }}
                >
                  {PKR(resolvedUnitPrice)}
                </div>
                {product.was && (
                  <div
                    style={{ fontSize: 15, color: "var(--ink-4)", textDecoration: "line-through" }}
                  >
                    {PKR(product.was)}
                  </div>
                )}
                {product.was && product.was > resolvedUnitPrice && (
                  <Pill tone="rose">Save {PKR(product.was - resolvedUnitPrice)}</Pill>
                )}
              </div>
              <div
                className="wcm-detail-tax-note"
                style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 4 }}
              >
                Inclusive of all taxes · Free delivery in Karachi over Rs 2,000
              </div>
            </div>
          </Section>
          {isPolysling && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>
                Type{selectedAgeGroup ? `: ${selectedAgeGroup}` : ""}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["Child", "Adult"] as const).map((group) => (
                  <button
                    key={group}
                    onClick={() => setSelectedAgeGroup(group === selectedAgeGroup ? null : group)}
                    style={{
                      padding: "6px 20px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      border:
                        selectedAgeGroup === group
                          ? "2px solid var(--pill-teal-fg)"
                          : "1.5px solid var(--line)",
                      background:
                        selectedAgeGroup === group ? "var(--pill-teal-bg)" : "var(--card)",
                      color: selectedAgeGroup === group ? "var(--pill-teal-fg)" : "var(--ink-3)",
                      transition: "border-color .12s, background .12s, color .12s",
                    }}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isAbdominalBelt && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>
                Fit{selectedFit ? `: ${selectedFit}` : ""}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["Adjustable", "Medium"] as const).map((fit) => (
                  <button
                    key={fit}
                    onClick={() => setSelectedFit(fit === selectedFit ? null : fit)}
                    style={{
                      padding: "6px 20px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      border:
                        selectedFit === fit
                          ? "2px solid var(--pill-teal-fg)"
                          : "1.5px solid var(--line)",
                      background: selectedFit === fit ? "var(--pill-teal-bg)" : "var(--card)",
                      color: selectedFit === fit ? "var(--pill-teal-fg)" : "var(--ink-3)",
                      transition: "border-color .12s, background .12s, color .12s",
                    }}
                  >
                    {fit}
                  </button>
                ))}
              </div>
            </div>
          )}
          {hasSelectableOptions && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                border: "1px solid var(--line)",
                borderRadius: 12,
                background: "var(--bg-elev)",
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink-2)" }}>
                  {optionLabel}
                  {selectedSize ? `: ${selectedSize}` : ""}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {product.size_chart_image && (
                    <button
                      type="button"
                      onClick={() => setShowSizeChart(true)}
                      style={{ fontSize: 12, fontWeight: 700, color: "var(--pill-teal-fg)", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
                    >
                      Size chart
                    </button>
                  )}
                  <div style={{ fontSize: 12, color: "var(--ink-4)", fontWeight: 600 }}>
                    Select one option
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {selectableOptions.map((option) => {
                  const isSelected = selectedSize === option.label;
                  return (
                    <button
                      key={option.label}
                      onClick={() => setSelectedSize(option.label)}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: isSelected
                          ? "2px solid var(--pill-teal-fg)"
                          : "1px solid var(--line)",
                        background: isSelected ? "var(--pill-teal-bg)" : "var(--card)",
                        color: isSelected ? "var(--pill-teal-fg)" : "var(--ink-3)",
                        transition: "all .14s ease",
                        boxShadow: isSelected ? "0 6px 14px -10px rgba(13,148,136,.6)" : "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        lineHeight: 1.2,
                      }}
                    >
                      <span>{option.label}</span>
                      <span style={{ opacity: 0.85, fontWeight: 600 }}>{PKR(option.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {!hasSelectableOptions && isOrthoBelt && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                border: "1px solid var(--line)",
                borderRadius: 12,
                background: "var(--bg-elev)",
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink-2)" }}>
                  Size{selectedSize ? `: ${selectedSize}` : ""}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {product.size_chart_image && (
                    <button
                      type="button"
                      onClick={() => setShowSizeChart(true)}
                      style={{ fontSize: 12, fontWeight: 700, color: "var(--pill-teal-fg)", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
                    >
                      Size chart
                    </button>
                  )}
                  <div style={{ fontSize: 12, color: "var(--ink-4)", fontWeight: 600 }}>
                    Select one option
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(["S", "M", "L", "XL", "XXL", "XXXL"] as const).map((size) => {
                  const isSelected = selectedSize === size;
                  return (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size === selectedSize ? null : size)}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: isSelected
                          ? "2px solid var(--pill-teal-fg)"
                          : "1px solid var(--line)",
                        background: isSelected ? "var(--pill-teal-bg)" : "var(--card)",
                        color: isSelected ? "var(--pill-teal-fg)" : "var(--ink-3)",
                        transition: "all .14s ease",
                        boxShadow: isSelected ? "0 6px 14px -10px rgba(13,148,136,.6)" : "none",
                        minWidth: 52,
                        lineHeight: 1.2,
                      }}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="wcm-add-row">
            <div
              className="wcm-add-qty"
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
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="wcm-add-qty-btn"
                style={qtyBtn}
                aria-label="Decrease quantity"
              >
                {Icons.minus}
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="wcm-add-qty-value"
                aria-label="Quantity"
                value={qty}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  if (digits === "") return;
                  setQty(Math.min(5, Math.max(1, Number(digits))));
                }}
                onBlur={(e) => {
                  if (e.target.value.trim() === "") setQty(1);
                }}
                style={{
                  minWidth: 42,
                  width: 42,
                  textAlign: "center",
                  fontWeight: 700,
                  border: "none",
                  background: "transparent",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  color: "var(--ink)",
                  padding: 0,
                }}
              />
              <button
                onClick={() => setQty((q) => q + 1)}
                className="wcm-add-qty-btn"
                style={{ ...qtyBtn, opacity: qty >= 5 ? 0.5 : 1 }}
                aria-label="Increase quantity"
                disabled={qty >= 5}
              >
                {Icons.plus}
              </button>
            </div>
            {qty >= 5 && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--pill-warn-fg)",
                  fontWeight: 600,
                  marginTop: 6,
                }}
              >
                Max 5 units per order
              </div>
            )}
            <Btn
              full
              size="lg"
              icon={Icons.cart}
              onClick={() => addToCart(product, qty, variantKey)}
              style={{ minHeight: 50 }}
            >
              {inCart ? "Update cart" : "Add to cart"} · {PKR(resolvedUnitPrice * qty)}
            </Btn>
            <Btn
              variant="outline"
              size="md"
              icon={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={isSaved ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              }
              onClick={() => toggleWishlist(product.id)}
              aria-label={isSaved ? "Remove from saved" : "Save item"}
              style={{
                width: 50,
                minWidth: 50,
                minHeight: 50,
                paddingLeft: 0,
                paddingRight: 0,
                ...(isSaved
                  ? {
                      background: "var(--pill-rose-bg)",
                      color: "var(--pill-rose-fg)",
                      border: "1px solid var(--pill-rose-bg)",
                    }
                  : {}),
              }}
            />
          </div>
          <div className="wcm-pdp-sticky-cta">
            <div
              className="wcm-add-qty"
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
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="wcm-add-qty-btn"
                style={qtyBtn}
                aria-label="Decrease quantity"
              >
                {Icons.minus}
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="wcm-add-qty-value"
                aria-label="Quantity"
                value={qty}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  if (digits === "") return;
                  setQty(Math.min(5, Math.max(1, Number(digits))));
                }}
                onBlur={(e) => {
                  if (e.target.value.trim() === "") setQty(1);
                }}
                style={{
                  minWidth: 42,
                  width: 42,
                  textAlign: "center",
                  fontWeight: 700,
                  border: "none",
                  background: "transparent",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  color: "var(--ink)",
                  padding: 0,
                }}
              />
              <button
                onClick={() => setQty((q) => q + 1)}
                className="wcm-add-qty-btn"
                style={{ ...qtyBtn, opacity: qty >= 5 ? 0.5 : 1 }}
                aria-label="Increase quantity"
                disabled={qty >= 5}
              >
                {Icons.plus}
              </button>
            </div>
            <button
              onClick={() => addToCart(product, qty, variantKey)}
              className="wcm-pdp-sticky-add"
              style={{
                border: "none",
                borderRadius: 12,
                background: "var(--grad)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                padding: "12px 14px",
                fontFamily: "inherit",
                cursor: "pointer",
                flex: 1,
                minHeight: 44,
              }}
            >
              {(inCart ? "Update cart" : "Add to cart") + " · " + PKR(resolvedUnitPrice * qty)}
            </button>
          </div>
          {hasMultipleImages && (
            <div className="wcm-detail-thumbs-mobile">
              {thumbIndexes.map((i) => (
                <button
                  key={`mobile-thumb-${i}`}
                  onClick={() => setActiveView(i)}
                  aria-label={detailMedia[i].type === "video" ? `Play video ${i + 1}` : `Show image ${i + 1}`}
                  style={{
                    position: "relative",
                    aspectRatio: "1/1",
                    borderRadius: 9,
                    border: "1px solid var(--line)",
                    background: `linear-gradient(135deg, var(--bg-elev), var(--chip))`,
                    opacity: i === activeView ? 1 : 0.7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    cursor: "pointer",
                    ...(i === activeView
                      ? {
                          borderColor: "var(--blue-600)",
                          boxShadow: "0 0 0 2px var(--pill-info-bg)",
                        }
                      : {}),
                  }}
                >
                  {detailMedia[i].type === "video" ? (
                    <>
                      <video
                        src={detailMedia[i].src}
                        muted
                        preload="metadata"
                        onLoadedMetadata={(e) => {
                          // 0.1s still lands inside a fade-in on edited
                          // clips (title card fading in from black); 1.5s
                          // reliably clears that without needing per-video
                          // tuning. Browsers clamp the seek for shorter clips.
                          e.currentTarget.currentTime = Math.min(1.5, e.currentTarget.duration / 2 || 1.5);
                        }}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <PlayBadge />
                    </>
                  ) : (
                    <ProductPhoto
                      src={detailMedia[i].src}
                      alt={`${product.name} thumbnail ${i + 1}`}
                      containerStyle={{ width: "100%", height: "100%" }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
          <Section className="wcm-detail-about" style={{ padding: 16 }}>
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
          </Section>
          <div className="wcm-product-badges">
            {[
              { i: Icons.shield, t: "100% authentic", s: "Direct from brands" },
              { i: Icons.refresh, t: "3-day returns", s: "No questions asked" },
              { i: Icons.truck, t: "3-5 working days", s: "Delivered nationwide" },
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
                <div className="wcm-badge-sub" style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{b.s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TestimonialsSection />

      {(!productsLoaded || related.length > 0) && (
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
              gridTemplateColumns: isMobile
                ? "repeat(auto-fill, minmax(160px, 1fr))"
                : "repeat(auto-fill, minmax(220px, 1fr))",
              gap: isMobile ? 8 : 14,
            }}
          >
            {!productsLoaded
              ? Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardSkeleton key={i} isMobile={isMobile} />
                ))
              : related.map((r) => (
                  <ProductCard
                    key={r.id}
                    p={r}
                    onAdd={addToCart}
                    onOpen={openProduct}
                    cartQty={cart.find((c) => c.id === r.id)?.qty ?? 0}
                    compact={isMobile}
                  />
                ))}
          </div>
        </div>
      )}

      {showSizeChart && product.size_chart_image && (
        <div
          onClick={() => setShowSizeChart(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: 560,
              width: "100%",
              maxHeight: "85vh",
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: 16,
              overflow: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>Size chart</div>
              <button
                type="button"
                onClick={() => setShowSizeChart(false)}
                aria-label="Close size chart"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", padding: 4, display: "flex" }}
              >
                {Icons.close}
              </button>
            </div>
            <img
              src={product.size_chart_image}
              alt={`${product.name} size chart`}
              style={{ width: "100%", height: "auto", borderRadius: 10, display: "block" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
