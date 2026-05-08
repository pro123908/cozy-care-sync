import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Icons, WellcareWordmark } from "./icons";
import { ProductImageFallback } from "./ui";
import { useWcm, WcmProvider } from "./context";

const CartDrawer = lazy(() => import("./cart").then((m) => ({ default: m.CartDrawer })));
const OrderSuccess = lazy(() => import("./orders").then((m) => ({ default: m.OrderSuccess })));
const AuthModal = lazy(() => import("./auth").then((m) => ({ default: m.AuthModal })));

function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return !!sessionStorage.getItem("wcm_pwa_dismissed");
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!prompt || dismissed) return null;

  const install = async () => {
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted" || outcome === "dismissed") {
      setPrompt(null);
    }
  };

  const dismiss = () => {
    try {
      sessionStorage.setItem("wcm_pwa_dismissed", "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(560px, calc(100vw - 24px))",
        top: "calc(env(safe-area-inset-top, 0px) + 12px)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid var(--line)",
        background: "var(--card)",
        boxShadow: "0 10px 26px rgba(0,0,0,0.12)",
        animation: "fadeIn .25s ease",
      }}
    >
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "var(--grad)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2v13M8 10l4 5 4-5M5 20h14" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Add to Home Screen</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 1 }}>
          Get the full app experience
        </div>
      </div>
      <button
        onClick={install}
        style={{
          padding: "7px 12px",
          borderRadius: 9,
          border: "none",
          background: "var(--grad)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          flexShrink: 0,
        }}
      >
        Install
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          border: "1px solid var(--line)",
          background: "var(--card)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-4)",
          flexShrink: 0,
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
export function App() {
  return (
    <WcmProvider>
      <AppLayout />
    </WcmProvider>
  );
}

function AppLayout() {
  const {
    theme,
    toggleTheme,
    user,
    isAdmin,
    setUser,
    authOpen,
    setAuthOpen,
    onSignOut,
    cart,
    setCart,
    cartOpen,
    setCartOpen,
    cartCount,
    wishlist,
    setCheckoutData,
    successOrder,
    setSuccessOrder,
    push,
    Toaster,
    products,
  } = useWcm();

  const navigate = useNavigate();

  const goCheckout = (items: any[], subtotal: number, shipping: number, total: number) => {
    if (!user) {
      setCartOpen(false);
      setAuthOpen(true);
      return;
    }
    setCartOpen(false);
    setCheckoutData({ items, subtotal, shipping, total });
    navigate({ to: "/checkout" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        cartCount={cartCount}
        onCartOpen={() => setCartOpen(true)}
        user={user}
        isAdmin={isAdmin}
        onSignIn={() => setAuthOpen(true)}
        onSignOut={onSignOut}
      />
      <main
        className="wcm-main"
        style={{ width: "100%", maxWidth: 1240, margin: "0 auto", flex: 1 }}
      >
        <Outlet />
      </main>
      <Footer />
      <BottomNav
        cartCount={cartCount}
        cartOpen={cartOpen}
        onCartOpen={() => setCartOpen(true)}
        onCartClose={() => setCartOpen(false)}
      />
      <PwaInstallBanner />

      <Suspense fallback={null}>
        <CartDrawer
          open={cartOpen}
          cart={cart}
          products={products}
          setCart={setCart}
          onClose={() => setCartOpen(false)}
          onCheckout={goCheckout}
        />
        {successOrder && (
          <OrderSuccess
            order={successOrder}
            onClose={() => setSuccessOrder(null)}
            onView={() => {
              const o = successOrder!;
              setSuccessOrder(null);
              navigate({ to: "/orders/$orderId", params: { orderId: o.id } });
            }}
          />
        )}
        {authOpen && (
          <AuthModal
            onClose={() => setAuthOpen(false)}
            notify={push}
            onSignIn={(u) => {
              setUser(u);
              setAuthOpen(false);
              push(`Welcome, ${u.firstName}!`);
            }}
          />
        )}
      </Suspense>
      <Toaster />
    </div>
  );
}

const RECENT_SEARCHES_KEY = "wcm_recent_searches";
const POPULAR_SEARCHES = ["Glucometer", "Wheelchair", "Pulse oximeter", "Nebulizer"];

function highlightText(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "var(--pill-info-bg)", color: "var(--pill-info-fg)", padding: 0 }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function Header({
  theme,
  toggleTheme,
  cartCount,
  onCartOpen,
  user,
  isAdmin,
  onSignIn,
  onSignOut,
}: {
  theme: string;
  toggleTheme: () => void;
  cartCount: number;
  onCartOpen: () => void;
  user: import("./context").WcmUser | null;
  isAdmin: boolean;
  onSignIn: () => void;
  onSignOut: () => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { wishlist, products } = useWcm();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isProducts = pathname === "/" || pathname.startsWith("/products");
  const isCategories = pathname.startsWith("/categories");
  const isDeals = pathname.startsWith("/deals");
  const isOrders = pathname.startsWith("/orders");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setRecentSearches(parsed.filter((x) => typeof x === "string"));
    } catch {
      // ignore malformed local storage payloads
    }
  }, []);

  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const results = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return [];
    return products
      .map((p) => {
        const name = p.name.toLowerCase();
        const brand = p.brand.toLowerCase();
        const blurb = p.blurb.toLowerCase();
        const category = (p.category_name || p.cat).toLowerCase();
        let score = 0;
        if (name.startsWith(q)) score += 8;
        if (name.includes(q)) score += 5;
        if (brand.startsWith(q)) score += 4;
        if (brand.includes(q)) score += 2;
        if (category.includes(q)) score += 2;
        if (blurb.includes(q)) score += 1;
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.p);
  }, [products, debouncedSearch]);

  const persistRecentSearch = (term: string) => {
    const cleaned = term.trim();
    if (!cleaned) return;
    setRecentSearches((prev) => {
      const next = [
        cleaned,
        ...prev.filter((x) => x.toLowerCase() !== cleaned.toLowerCase()),
      ].slice(0, 5);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearSearch = () => {
    setSearch("");
    setDropOpen(false);
  };

  const goProduct = (id: string) => {
    if (search.trim()) persistRecentSearch(search);
    clearSearch();
    navigate({ to: "/products/$productId", params: { productId: id } });
  };

  const applySearchSuggestion = (term: string) => {
    setSearch(term);
    setDropOpen(true);
    inputRef.current?.focus();
    persistRecentSearch(term);
  };

  return (
    <>
      <div
        style={{
          background: "var(--grad)",
          color: "#fff",
          fontSize: 12.5,
          padding: "7px 14px",
          textAlign: "center",
          letterSpacing: 0.2,
        }}
      >
        🚚 Free delivery in Karachi on orders above Rs 5,000
      </div>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "var(--header-bg)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div
          className="wcm-header-pad wcm-header-grid"
          style={{
            width: "100%",
            maxWidth: 1240,
            margin: "0 auto",
            display: "grid",
            alignItems: "center",
          }}
        >
          <button
            className="wcm-brand-btn"
            onClick={() => navigate({ to: "/" })}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <WellcareWordmark height={24} />
          </button>

          <div className="wcm-header-mid">
            <div className="wcm-search-wrap" style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--ink-4)",
                  zIndex: 1,
                }}
              >
                {Icons.search}
              </span>
              <input
                ref={inputRef}
                placeholder="Search products…"
                aria-label="Search products"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setDropOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && results[0]) {
                    e.preventDefault();
                    goProduct(results[0].id);
                  }
                }}
                onFocus={() => setDropOpen(true)}
                onBlur={() => setTimeout(() => setDropOpen(false), 150)}
                style={{
                  width: "100%",
                  padding: "11px 14px 11px 42px",
                  borderRadius:
                    dropOpen && (results.length > 0 || !search.trim()) ? "18px 18px 0 0" : 99,
                  border: "1px solid var(--line)",
                  background: "var(--bg-elev)",
                  fontSize: 13.5,
                  fontFamily: "inherit",
                  outline: "none",
                  transition: "border-color .15s, box-shadow .15s",
                }}
                onFocusCapture={(e) => {
                  e.currentTarget.style.borderColor = "var(--blue-500)";
                  e.currentTarget.style.background = "var(--card)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px var(--pill-info-bg)";
                }}
                onBlurCapture={(e) => {
                  e.currentTarget.style.borderColor = "var(--line)";
                  e.currentTarget.style.background = "var(--bg-elev)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderRadius = "99px";
                }}
              />
              {dropOpen && (results.length > 0 || !search.trim()) && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    maxHeight: "min(68vh, 460px)",
                    background: "var(--card)",
                    border: "1px solid var(--blue-500)",
                    borderTop: "none",
                    borderRadius: "0 0 18px 18px",
                    boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                    zIndex: 200,
                    overflowX: "hidden",
                    overflowY: "auto",
                    WebkitOverflowScrolling: "touch",
                    overscrollBehavior: "contain",
                  }}
                >
                  {!search.trim() ? (
                    <div style={{ padding: 12 }}>
                      {recentSearches.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "var(--ink-4)",
                              marginBottom: 8,
                            }}
                          >
                            Recent searches
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {recentSearches.map((term) => (
                              <button
                                key={term}
                                onMouseDown={() => applySearchSuggestion(term)}
                                style={{
                                  border: "1px solid var(--line)",
                                  background: "var(--bg-elev)",
                                  borderRadius: 99,
                                  padding: "6px 10px",
                                  fontSize: 12,
                                  color: "var(--ink-3)",
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                {term}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--ink-4)",
                            marginBottom: 8,
                          }}
                        >
                          Popular
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {POPULAR_SEARCHES.map((term) => (
                            <button
                              key={term}
                              onMouseDown={() => applySearchSuggestion(term)}
                              style={{
                                border: "1px solid var(--line)",
                                background: "var(--card)",
                                borderRadius: 99,
                                padding: "6px 10px",
                                fontSize: 12,
                                color: "var(--ink-2)",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontFamily: "inherit",
                              }}
                            >
                              {term}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : results.length > 0 ? (
                    results.map((p) => (
                      <button
                        key={p.id}
                        onMouseDown={() => goProduct(p.id)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 16px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                          borderBottom: "1px solid var(--line)",
                          transition: "background .1s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--chip-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 9,
                            overflow: "hidden",
                            border: "1px solid var(--line)",
                            background: "var(--bg-elev)",
                            flexShrink: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              loading="lazy"
                              decoding="async"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          ) : (
                            <ProductImageFallback
                              cat={p.cat}
                              name={p.name}
                              brand={p.brand}
                              swatch={p.swatch}
                              compact
                            />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13.5,
                              fontWeight: 600,
                              color: "var(--ink)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {highlightText(p.name, search)}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 1 }}>
                            {highlightText(p.brand, search)} &middot; {p.category_name || p.cat}
                          </div>
                        </div>
                        <div
                          style={{
                            marginLeft: "auto",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "var(--blue-600)",
                            flexShrink: 0,
                          }}
                        >
                          Rs {p.price.toLocaleString()}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ color: "var(--ink-3)", fontSize: 13, fontWeight: 700 }}>
                        No matching products found
                      </div>
                      <div style={{ color: "var(--ink-4)", fontSize: 12, marginTop: 4 }}>
                        Try one of these popular searches:
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 9 }}>
                        {POPULAR_SEARCHES.slice(0, 3).map((term) => (
                          <button
                            key={`empty-${term}`}
                            onMouseDown={() => applySearchSuggestion(term)}
                            style={{
                              border: "1px solid var(--line)",
                              background: "var(--bg-elev)",
                              borderRadius: 99,
                              padding: "6px 9px",
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--ink-3)",
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <nav className="wcm-nav-desktop" style={{ display: "flex", gap: 4 }}>
              <NavBtn active={isProducts} onClick={() => navigate({ to: "/" })} icon={Icons.home}>
                Shop
              </NavBtn>
              <NavBtn
                active={isCategories}
                onClick={() => navigate({ to: "/categories" })}
                icon={Icons.filter}
              >
                Categories
              </NavBtn>
              <NavBtn
                active={isDeals}
                onClick={() => navigate({ to: "/deals" })}
                icon={Icons.percent}
              >
                Deals
              </NavBtn>
              <NavBtn
                active={isOrders}
                onClick={() => navigate({ to: "/orders" })}
                icon={Icons.pkg}
              >
                Orders
              </NavBtn>
            </nav>
          </div>

          <div className="wcm-header-right">
            {isAdmin && <ThemeToggle theme={theme} onToggle={toggleTheme} />}
            <button
              onClick={onCartOpen}
              aria-label="Cart"
              className="wcm-desktop-only"
              style={{ ...iconBtn, position: "relative" }}
            >
              {Icons.cart}
              {cartCount > 0 && <CartBadge n={cartCount} />}
            </button>
            {user ? (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setMenuOpen((o: boolean) => !o)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 10px 4px 4px",
                    borderRadius: 99,
                    border: "1px solid var(--line)",
                    background: "var(--card)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 99,
                      background: "var(--grad)",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {user.initials}
                  </div>
                  <span
                    className="wcm-user-name"
                    style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}
                  >
                    {user.firstName}
                  </span>
                </button>
                {menuOpen && (
                  <>
                    <div
                      onClick={() => setMenuOpen(false)}
                      style={{ position: "fixed", inset: 0, zIndex: 60 }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "calc(100% + 8px)",
                        zIndex: 61,
                        minWidth: 240,
                        background: "var(--card)",
                        border: "1px solid var(--line)",
                        borderRadius: 14,
                        boxShadow: "var(--shadow-lg)",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>
                          {user.firstName} {user.lastName}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>
                          {user.email}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          navigate({ to: "/orders" });
                        }}
                        style={menuItem}
                      >
                        {Icons.pkg} My orders
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          navigate({ to: "/account" });
                        }}
                        style={menuItem}
                      >
                        {Icons.user} Account settings
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            navigate({ to: "/admin" });
                          }}
                          style={menuItem}
                        >
                          {Icons.shield} Admin panel
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          navigate({ to: "/wishlist" });
                        }}
                        style={menuItem}
                      >
                        {Icons.heart} Saved items
                        {wishlist.length > 0 && (
                          <span
                            style={{
                              marginLeft: "auto",
                              minWidth: 18,
                              height: 18,
                              borderRadius: 99,
                              background: "var(--ink)",
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 800,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "0 5px",
                            }}
                          >
                            {wishlist.length}
                          </span>
                        )}
                      </button>
                      <div style={{ height: 1, background: "var(--line)" }} />
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onSignOut();
                        }}
                        style={{ ...menuItem, color: "var(--pill-rose-fg)" }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                        </svg>
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={onSignIn}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 99,
                  background: "var(--grad)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  boxShadow: "0 6px 14px -6px rgba(37,99,235,.4)",
                }}
              >
                {Icons.user} <span className="wcm-user-name">Sign in</span>
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

const CartBadge = ({ n }: { n: number }) => (
  <span
    style={{
      position: "absolute",
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      padding: "0 5px",
      borderRadius: 99,
      background: "var(--green-500)",
      color: "#fff",
      fontSize: 10.5,
      fontWeight: 800,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      border: "2px solid var(--card)",
    }}
  >
    {n}
  </span>
);

const menuItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "11px 16px",
  border: "none",
  background: "transparent",
  color: "var(--ink-2)",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
};

function NavBtn({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "9px 14px",
        borderRadius: 99,
        background: active ? "var(--ink)" : "transparent",
        color: active ? "var(--card)" : "var(--ink-2)",
        border: "none",
        cursor: "pointer",
        fontWeight: 700,
        fontSize: 13.5,
        fontFamily: "inherit",
      }}
    >
      <span style={{ display: "inline-flex" }}>{icon}</span> {children}
    </button>
  );
}

function BottomNav({
  cartCount,
  cartOpen,
  onCartOpen,
  onCartClose,
}: {
  cartCount: number;
  cartOpen: boolean;
  onCartOpen: () => void;
  onCartClose: () => void;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isCartActive = !!cartOpen;
  const isProducts = !isCartActive && (pathname === "/" || pathname.startsWith("/products"));
  const isCategories = !isCartActive && pathname.startsWith("/categories");
  const isOrders = !isCartActive && pathname.startsWith("/orders");

  const items = [
    {
      id: "products",
      label: "Shop",
      icon: Icons.home,
      action: () => {
        onCartClose?.();
        navigate({ to: "/" });
      },
      active: isProducts,
    },
    {
      id: "categories",
      label: "Cats",
      icon: Icons.filter,
      action: () => {
        onCartClose?.();
        navigate({ to: "/categories" });
      },
      active: isCategories,
    },
    {
      id: "cart",
      label: "Cart",
      icon: Icons.cart,
      action: onCartOpen,
      badge: cartCount,
      active: isCartActive,
    },
    {
      id: "orders",
      label: "Orders",
      icon: Icons.pkg,
      action: () => {
        onCartClose?.();
        navigate({ to: "/orders" });
      },
      active: isOrders,
    },
  ];
  return (
    <nav className="wcm-bottomnav">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={it.action}
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            padding: "6px 14px",
            border: "none",
            background: "transparent",
            color: it.active ? "var(--blue-700)" : "var(--ink-3)",
            fontWeight: 700,
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
            minWidth: 60,
          }}
        >
          <span style={{ position: "relative" }}>
            {it.icon}
            {(it.badge ?? 0) > 0 && <CartBadge n={it.badge as number} />}
          </span>
          {it.label}
        </button>
      ))}
    </nav>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: string; onToggle: () => void }) {
  const dark = theme === "dark";
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
      style={{
        position: "relative",
        width: 54,
        height: 30,
        borderRadius: 99,
        border: "1px solid var(--line)",
        background: dark
          ? "linear-gradient(135deg, #0f172a, #1e293b)"
          : "linear-gradient(135deg, #f0f9ff, #fef9c3)",
        cursor: "pointer",
        padding: 0,
        transition: "background .25s ease",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,.1)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 8,
          top: "50%",
          transform: "translateY(-50%)",
          color: dark ? "rgba(255,255,255,.35)" : "#f59e0b",
          display: "inline-flex",
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      </span>
      <span
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          color: dark ? "#cbd5e1" : "rgba(15,23,42,.25)",
          display: "inline-flex",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
        </svg>
      </span>
      <span
        style={{
          position: "absolute",
          top: 3,
          left: dark ? 27 : 3,
          width: 22,
          height: 22,
          borderRadius: 99,
          background: dark ? "linear-gradient(135deg, #1e293b, #334155)" : "#fff",
          boxShadow: "0 2px 6px rgba(0,0,0,.25), 0 1px 2px rgba(0,0,0,.15)",
          transition: "left .25s cubic-bezier(.4,.7,.3,1.3), background .25s",
        }}
      />
    </button>
  );
}

const iconBtn: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 99,
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink-2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

function Footer() {
  return (
    <footer
      style={{ background: "var(--card)", borderTop: "1px solid var(--line)", marginTop: "auto" }}
    >
      <div
        className="wcm-footer-cols"
        style={{
          width: "100%",
          maxWidth: 1240,
          margin: "0 auto",
          padding: "30px 24px 24px",
          display: "grid",
        }}
      >
        <div>
          <WellcareWordmark height={22} />
          <p
            style={{
              marginTop: 14,
              color: "var(--ink-4)",
              fontSize: 13,
              lineHeight: 1.6,
              maxWidth: 340,
            }}
          >
            Wellcare Mart is your trusted online destination for reliable home healthcare — from
            daily monitoring to mobility, delivered to your door.
          </p>
        </div>
        {[
          {
            h: "Shop",
            links: [
              { label: "Glucometers", href: "/?category=glucometers" },
              { label: "BP Monitors", href: "/?category=bp-digital" },
              { label: "Wheel Chairs", href: "/?category=wheelchairs" },
              { label: "Nebulizers", href: "/?category=nebulizer" },
              { label: "Hearing Aids", href: "/?category=hearing-aids" },
              { label: "Massagers", href: "/?category=massagers" },
            ],
          },
          {
            h: "Help",
            links: [
              { label: "Track an order", href: "/orders" },
              { label: "Returns & refunds", href: "/policies#returns" },
              { label: "Shipping", href: "/policies#shipping" },
              { label: "Contact us", href: "/policies#contact" },
              { label: "FAQs", href: "/faqs" },
            ],
          },
          {
            h: "Company",
            links: [
              { label: "About Wellcare", href: "/about" },
              { label: "Privacy", href: "/policies#privacy" },
              { label: "Terms", href: "/policies#terms" },
            ],
          },
        ].map((col) => (
          <div key={col.h}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 0.4,
                color: "var(--ink-3)",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              {col.h}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {col.links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  style={{
                    color: "var(--ink-2)",
                    textDecoration: "none",
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          borderTop: "1px solid var(--line-2)",
          padding: "14px 24px",
          textAlign: "center",
          color: "var(--ink-4)",
          fontSize: 12,
        }}
      >
        © 2026 Wellcare Mart · Your Health, Our Care
      </div>
    </footer>
  );
}
