import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CATEGORIES, PKR, type Product } from "./data";
import { Icons } from "./icons";
import { ProductImage, ProductPhoto, Stars, Pill, Btn, Section } from "./ui";
import { useWcm, useProductRatings } from "./context";
import type { CartLine } from "./context";
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
} from "./products-filter-components";

const RECENTLY_VIEWED_KEY = "wcm_recently_viewed";
const RECENTLY_VIEWED_MAX = 12;
const HOMEPAGE_TOP_CATEGORIES_MOBILE = 10;
const HOMEPAGE_TOP_CATEGORIES_DESKTOP = 10;

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
}: {
  addToCart: (p: Product) => void;
  openProduct: (p: Product) => void;
  cart: CartLine[];
  goTo: (p: "products" | "orders") => void;
  category?: string;
  onCategoryChange?: (cat: string) => void;
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
  const [page, setPage] = useState(1);
  const [gridKey, setGridKey] = useState(0);
  const listingTopRef = useRef<HTMLDivElement | null>(null);
  const productsTopRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToProductsRef = useRef(false);
  const hasMountedPaginationRef = useRef(false);

  // Sync active category when URL param changes (e.g. browser back/forward)
  useEffect(() => {
    setActive(category ?? "all");
  }, [category]);

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
      arr = [...arr].sort((a, b) => (b.sales_count ?? 0) - (a.sales_count ?? 0));
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
    setPage(1);
  }, [active, sort, inStockOnly]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!productsLoaded) return;
    if (!hasMountedPaginationRef.current) {
      hasMountedPaginationRef.current = true;
      return;
    }
    listingTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page, productsLoaded]);

  useEffect(() => {
    if (!productsLoaded) return;
    if (!shouldScrollToProductsRef.current) return;
    shouldScrollToProductsRef.current = false;
    productsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active, productsLoaded]);

  const cartQtyById = useMemo(() => new Map(cart.map((c) => [c.id, c.qty])), [cart]);
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

    if (isMobile) {
      const mobileVisible = rankedCategories.slice(0, HOMEPAGE_TOP_CATEGORIES_MOBILE);
      const activeCategory = nonAllCategories.find((cat) => cat.id === active);
      const hasActive =
        !!activeCategory && mobileVisible.some((category) => category.id === activeCategory.id);

      if (activeCategory && activeCategory.id !== "all" && !hasActive && mobileVisible.length > 0) {
        mobileVisible[mobileVisible.length - 1] = activeCategory;
      }

      return mobileVisible;
    }

    return rankedCategories.slice(0, HOMEPAGE_TOP_CATEGORIES_DESKTOP);
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
          setActive={(v) => {
            shouldScrollToProductsRef.current = true;
            setActive(v);
            setGridKey((k) => k + 1);
            onCategoryChange?.(v);
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
          {isMobile && (
            <button
              className="wcm-mobile-filter-btn"
              onClick={() => setMobileFiltersOpen(true)}
              style={{ marginRight: "auto" }}
            >
              {Icons.filter} Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
            </button>
          )}
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
            Showing {filtered.length === 0 ? 0 : pageStart + 1}-
            {Math.min(pageStart + PRODUCTS_PAGE_SIZE, filtered.length)} of {filtered.length}
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
        <div className="wcm-filter-sheet-overlay" onClick={() => setMobileFiltersOpen(false)}>
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

      <div ref={productsTopRef} />

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
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} isMobile={isMobile} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Section
          key={gridKey}
          style={{ padding: 32, textAlign: "center", animation: "fadeInUp 0.25s ease" }}
        >
          <div className="wcm-empty-icon">🔎</div>
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                    color: activePage ? "#fff" : "var(--ink-2)",
                    borderColor: activePage ? "var(--ink)" : "var(--line)",
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

const paginationBtnStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 11,
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
};

const paginationEllipsisStyle: React.CSSProperties = {
  minWidth: 24,
  textAlign: "center",
  color: "var(--ink-4)",
  fontSize: 13,
  fontWeight: 700,
};

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
  const { products, categories, categoriesLoaded, wishlist, toggleWishlist } = useWcm();
  const getProductRatings = useProductRatings();
  const { average: userRating, count: reviewCount } = getProductRatings(product.id);
  const isMobile = useIsMobile();
  const { trackView } = useRecentlyViewed();
  const [qty, setQty] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<"Child" | "Adult" | null>(null);
  const [selectedFit, setSelectedFit] = useState<"Adjustable" | "Medium" | null>(null);
  const isOrthoBelt = product.cat === "ortho-belts" && product.id !== "belt-003";
  const isPolysling = product.id === "belt-004";
  const isAbdominalBelt = product.id === "belt-003";

  const variantKey = [selectedAgeGroup, selectedFit, selectedSize].filter(Boolean).join(" / ") || undefined;

  // Track this product as recently viewed
  useEffect(() => {
    trackView(product.id);
  }, [product.id, trackView]);
  const [activeView, setActiveView] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const inCart = cart.find((c) => c.id === product.id);
  const isSaved = wishlist.includes(product.id);
  const cat =
    (categoriesLoaded ? categories : CATEGORIES).find((c) => c.id === product.cat)?.name ||
    product.category_name ||
    product.cat;
  const related = products
    .filter((p: Product) => p.cat === product.cat && p.id !== product.id)
    .slice(0, 4);
  const detailImages = useMemo(() => {
    const primary = product.image_url ? [product.image_url] : [];
    const extra = Array.isArray(
      (product as Product & { image_urls?: Array<string | null | undefined> }).image_urls,
    )
      ? ((product as Product & { image_urls?: Array<string | null | undefined> }).image_urls ?? [])
      : [];
    return Array.from(new Set([...primary, ...extra].filter((src): src is string => Boolean(src))));
  }, [product]);
  const hasMultipleImages = detailImages.length > 1;
  const activeImageSrc = detailImages[activeView] ?? detailImages[0] ?? null;
  const thumbIndexes = detailImages.map((_, i) => i);

  useEffect(() => {
    setActiveView(0);
  }, [product.id, detailImages.length]);

  const cycleView = (dir: 1 | -1) => {
    if (detailImages.length <= 1) return;
    setActiveView((v) => (v + dir + detailImages.length) % detailImages.length);
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
            onTouchStart={(e) => {
              touchStartX.current = e.changedTouches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              if (!hasMultipleImages) return;
              const start = touchStartX.current;
              const end = e.changedTouches[0]?.clientX ?? null;
              if (start == null || end == null) return;
              const delta = end - start;
              if (Math.abs(delta) < 30) return;
              cycleView(delta < 0 ? 1 : -1);
            }}
          >
            {activeImageSrc ? (
              <ProductPhoto
                src={activeImageSrc}
                alt={product.name}
                loading="eager"
                containerStyle={{
                  width: "100%",
                  aspectRatio: "1/1",
                  borderRadius: 12,
                  border: "1px solid var(--line)",
                  background: "var(--bg-elev)",
                }}
                imgStyle={{ objectPosition: "center center" }}
              />
            ) : (
              <ProductImage product={product} />
            )}
          </div>
          {hasMultipleImages && (
            <div
              className="wcm-detail-thumbs-desktop"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 8,
                marginTop: 12,
              }}
            >
              {thumbIndexes.map((i) => (
                <button
                  key={i}
                  onClick={() => setActiveView(i)}
                  aria-label={`Show image ${i + 1}`}
                  style={{
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
                  <ProductPhoto
                    src={detailImages[i]}
                    alt={`${product.name} thumbnail ${i + 1}`}
                    containerStyle={{ width: "100%", height: "100%" }}
                  />
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
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                color: "var(--ink-4)",
                fontSize: 13,
              }}
            >
              <Stars value={userRating || product.rating} />
              <span>
                · {reviewCount || product.reviews} {reviewCount ? "user" : "verified"} reviews
              </span>
            </div>
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
              <div
                className="wcm-detail-tax-note"
                style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 4 }}
              >
                Inclusive of all taxes · Free delivery over Rs 2,000
              </div>
            </div>
            <div
              className="wcm-detail-stock-pill"
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
                      border: selectedAgeGroup === group
                        ? "2px solid #0d9488"
                        : "1.5px solid var(--line)",
                      background: selectedAgeGroup === group ? "#f0fdfa" : "var(--card)",
                      color: selectedAgeGroup === group ? "#0f766e" : "var(--ink-3)",
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
                      border: selectedFit === fit ? "2px solid #0d9488" : "1.5px solid var(--line)",
                      background: selectedFit === fit ? "#f0fdfa" : "var(--card)",
                      color: selectedFit === fit ? "#0f766e" : "var(--ink-3)",
                      transition: "border-color .12s, background .12s, color .12s",
                    }}
                  >
                    {fit}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isOrthoBelt && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>
                Size{selectedSize ? `: ${selectedSize}` : ""}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(["S", "M", "L", "XL", "XXL", "XXXL"] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size === selectedSize ? null : size)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: selectedSize === size
                        ? "2px solid #0d9488"
                        : "1.5px solid var(--line)",
                      background: selectedSize === size ? "#f0fdfa" : "var(--card)",
                      color: selectedSize === size ? "#0f766e" : "var(--ink-3)",
                      transition: "border-color .12s, background .12s, color .12s",
                    }}
                  >
                    {size}
                  </button>
                ))}
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
              <div
                className="wcm-add-qty-value"
                style={{ minWidth: 42, textAlign: "center", fontWeight: 700 }}
              >
                {qty}
              </div>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="wcm-add-qty-btn"
                style={qtyBtn}
                aria-label="Increase quantity"
              >
                {Icons.plus}
              </button>
            </div>
            <Btn
              full
              size="lg"
              icon={Icons.cart}
              onClick={() => addToCart(product, qty, variantKey)}
              style={{ minHeight: 50 }}
            >
              {inCart ? "Update cart" : "Add to cart"} · {PKR(product.price * qty)}
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
              <div
                className="wcm-add-qty-value"
                style={{ minWidth: 42, textAlign: "center", fontWeight: 700 }}
              >
                {qty}
              </div>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="wcm-add-qty-btn"
                style={qtyBtn}
                aria-label="Increase quantity"
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
              {(inCart ? "Update cart" : "Add to cart") + " · " + PKR(product.price * qty)}
            </button>
          </div>
          {hasMultipleImages && (
            <div className="wcm-detail-thumbs-mobile">
              {thumbIndexes.map((i) => (
                <button
                  key={`mobile-thumb-${i}`}
                  onClick={() => setActiveView(i)}
                  aria-label={`Show image ${i + 1}`}
                  style={{
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
                  <ProductPhoto
                    src={detailImages[i]}
                    alt={`${product.name} thumbnail ${i + 1}`}
                    containerStyle={{ width: "100%", height: "100%" }}
                  />
                </button>
              ))}
            </div>
          )}
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
              className="wcm-detail-meta-grid"
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
              gridTemplateColumns: isMobile
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(auto-fill, minmax(220px, 1fr))",
              gap: isMobile ? 8 : 14,
            }}
          >
            {related.map((r) => (
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
    </div>
  );
}
