import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { getSupabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToasts } from "./ui";
import type { WcmUser } from "./auth";
import {
  CATEGORIES,
  PRODUCTS,
  type Category,
  type Product,
  type Order,
  type OrderReview,
  getUnitPrice,
  normalizeSizeOptions,
  normalizeVariantOptions,
} from "./data";
import { trackMetaEvent, toMetaValue } from "@/lib/meta-pixel";

type ProductRecord = Database["public"]["Tables"]["products"]["Row"] & {
  categories?: { name?: string | null } | null;
  sales_count?: number | null;
  variant_options?: unknown;
};

const MAX_QTY_PER_PRODUCT = 5;

type CategoryRecord = Database["public"]["Tables"]["categories"]["Row"];

function scheduleIdleTask(task: () => void) {
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(task, { timeout: 1500 });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(task, 200);
  return () => window.clearTimeout(handle);
}

export type CartLine = { id: string; qty: number; size?: string };
export type CheckoutState = { items: any[]; subtotal: number; shipping: number; total: number };

// Re-export for consumers
export type { WcmUser };

type WcmContextType = {
  // Theme
  theme: string;
  toggleTheme: () => void;
  // User & Auth
  user: WcmUser | null;
  isAdmin: boolean;
  authReady: boolean;
  setUser: (u: WcmUser | null) => void;
  authOpen: boolean;
  setAuthOpen: (v: boolean) => void;
  onSignOut: () => Promise<void>;
  // Cart
  cart: CartLine[];
  setCart: Dispatch<SetStateAction<CartLine[]>>;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  cartCount: number;
  addToCart: (p: Product, qty?: number, size?: string) => void;
  // Wishlist
  wishlist: string[];
  toggleWishlist: (id: string) => void;
  // Products
  products: Product[];
  productsLoaded: boolean;
  categories: Category[];
  categoriesLoaded: boolean;
  // Orders
  orders: Order[];
  setOrders: Dispatch<SetStateAction<Order[]>>;
  ordersLoaded: boolean;
  loadOrders: (userId: string, email?: string) => Promise<void>;
  submitOrderReview: (
    orderId: string,
    productId: string,
    rating: number,
    comment: string,
  ) => Promise<void>;
  // Checkout
  checkoutData: CheckoutState | null;
  setCheckoutData: Dispatch<SetStateAction<CheckoutState | null>>;
  successOrder: Order | null;
  setSuccessOrder: Dispatch<SetStateAction<Order | null>>;
  // Toasts
  push: (msg: string, opts?: { tone?: string; icon?: React.ReactNode; ms?: number }) => void;
  Toaster: React.ComponentType;
};

const WcmContext = createContext<WcmContextType | null>(null);

export function useWcm() {
  const ctx = useContext(WcmContext);
  if (!ctx) throw new Error("useWcm must be used within WcmProvider");
  return ctx;
}

export function useProductRatings() {
  const { orders } = useWcm();

  return useCallback(
    (productId: string) => {
      const ratings: number[] = [];

      for (const order of orders) {
        const review = order.product_reviews?.[productId];
        if (review?.rating) {
          ratings.push(review.rating);
        }
      }

      if (ratings.length === 0) {
        return { average: 0, count: 0 };
      }

      const sum = ratings.reduce((a, b) => a + b, 0);
      const average = Math.round((sum / ratings.length) * 2) / 2; // Round to .5

      return { average, count: ratings.length };
    },
    [orders],
  );
}

export function WcmProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<string>("light");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("wcm-theme");
      if (stored && stored !== "light") setTheme(stored);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("wcm-theme", theme);
    } catch {}
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const [user, setUser] = useState<WcmUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>(() => {
    try {
      const saved = localStorage.getItem("wcm-cart");
      return saved ? (JSON.parse(saved) as CartLine[]) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("wcm-cart", JSON.stringify(cart));
    } catch {}
  }, [cart]);

  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("wcm-wishlist");
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("wcm-wishlist", JSON.stringify(wishlist));
    } catch {}
  }, [wishlist]);

  const toggleWishlist = (id: string) => {
    const isCurrentlySaved = wishlist.includes(id);
    if (!isCurrentlySaved) {
      const product = products.find((p) => p.id === id);
      const productUnitPrice = product ? getUnitPrice(product) : 0;
      trackMetaEvent(
        "AddToWishlist",
        {
          content_ids: [id],
          content_name: product?.name || id,
          content_type: "product",
          content_category: product?.category_name || product?.cat,
          brand: product?.brand,
          num_items: 1,
          contents: [{ id, quantity: 1, item_price: toMetaValue(productUnitPrice) }],
          value: toMetaValue(productUnitPrice),
          currency: "PKR",
        },
        {
          userData: { email: user?.email },
        },
      );
    }

    setWishlist((w) => {
      const isAdding = !w.includes(id);
      return isAdding ? [...w, id] : w.filter((x) => x !== id);
    });
    push(isCurrentlySaved ? "Removed from saved items" : "Added to saved items");
  };
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [checkoutData, setCheckoutData] = useState<CheckoutState | null>(null);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const { push, Toaster } = useToasts();

  const loadOrders = useCallback(async (userId: string, email?: string) => {
    const supabase = await getSupabase();
    const [ordersRes, guestOrdersRes, reviewsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      email
        ? supabase
            .from("orders")
            .select("*")
            .eq("email", email)
            .is("user_id", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("order_reviews")
        .select("order_code, product_id, rating, comment")
        .eq("user_id", userId),
    ]);
    setOrdersLoaded(true);
    if (ordersRes.error || !ordersRes.data) return;

    const mergedOrders = [...ordersRes.data];
    if (!guestOrdersRes.error && guestOrdersRes.data) {
      const existingCodes = new Set(mergedOrders.map((order) => order.order_code));
      for (const guestOrder of guestOrdersRes.data) {
        if (!existingCodes.has(guestOrder.order_code)) {
          mergedOrders.push(guestOrder);
        }
      }
      mergedOrders.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    let reviewsData = reviewsRes.data || [];
    if (reviewsRes.error) {
      // Backward compatibility if product_id is not present yet.
      const fallbackReviewsRes = await supabase
        .from("order_reviews")
        .select("order_code, rating, comment")
        .eq("user_id", userId);

      reviewsData = (fallbackReviewsRes.data || []).map(
        (row: { order_code: string; rating: number; comment: string | null }) => ({
          ...row,
          product_id: "__order__",
        }),
      );
    }

    const reviewMap: Record<string, Record<string, OrderReview>> = {};
    for (const r of reviewsData) {
      if (!r.product_id || r.product_id === "__order__") continue;
      if (!reviewMap[r.order_code]) {
        reviewMap[r.order_code] = {};
      }
      reviewMap[r.order_code][r.product_id] = { rating: r.rating, comment: r.comment || "" };
    }
    setOrders(
      mergedOrders.map((r: Database["public"]["Tables"]["orders"]["Row"]) => ({
        id: r.order_code,
        placed: r.placed,
        eta: r.eta,
        status: r.status,
        progress: r.progress,
        address: r.address,
        payment: r.payment,
        items:
          (r.items as Array<{ id: string; qty: number; size?: string; unit_price?: number }>) || [],
        subtotal: r.subtotal,
        shipping: r.shipping,
        total: r.total,
        rider: (r.rider as { name?: string; phone?: string } | undefined) || undefined,
        product_reviews: reviewMap[r.order_code] || {},
      })),
    );
  }, []);

  const submitOrderReview = useCallback(
    async (orderId: string, productId: string, rating: number, comment: string) => {
      const supabase = await getSupabase();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("order_reviews")
        .upsert(
          { order_code: orderId, product_id: productId, user_id: authUser.id, rating, comment },
          { onConflict: "order_code,user_id,product_id" },
        );
      if (error) throw error;
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                product_reviews: {
                  ...(o.product_reviews || {}),
                  [productId]: { rating, comment },
                },
              }
            : o,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const initAuth = async () => {
      const supabase = await getSupabase();
      if (cancelled) return;

      const { data: sub } = supabase.auth.onAuthStateChange(
        (
          _e: string,
          session: {
            user?: { id: string; email?: string | null; user_metadata?: Record<string, any> };
          } | null,
        ) => {
          const sUser = session?.user;
          if (!sUser) {
            setUser(null);
            setOrders([]);
            setOrdersLoaded(false);
            return;
          }
          setTimeout(async () => {
            const { data: prof } = await supabase
              .from("profiles")
              .select("first_name,last_name,email,role")
              .eq("id", sUser.id)
              .maybeSingle();
            const fullName = sUser.user_metadata?.full_name || sUser.user_metadata?.name || "";
            const [metaFirst = "", ...metaRest] = fullName.trim().split(" ");
            const metaLast = metaRest.join(" ");
            const firstName =
              prof?.first_name || sUser.user_metadata?.first_name || metaFirst || "Friend";
            const lastName = prof?.last_name || sUser.user_metadata?.last_name || metaLast || "";
            const initials = ((firstName[0] || "U") + (lastName[0] || "")).toUpperCase();
            const role =
              (prof as { role?: "customer" | "staff" | "admin" } | null)?.role || "customer";
            setUser({ firstName, lastName, email: sUser.email || "", initials, role });
            loadOrders(sUser.id, sUser.email || prof?.email || undefined);
          }, 0);
        },
      );
      unsubscribe = () => {
        sub.subscription.unsubscribe();
      };

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session?.user) {
        const sUser = session.user;
        const { data: prof } = await supabase
          .from("profiles")
          .select("first_name,last_name,email,role")
          .eq("id", sUser.id)
          .maybeSingle();
        const fullName = sUser.user_metadata?.full_name || sUser.user_metadata?.name || "";
        const [metaFirst = "", ...metaRest] = fullName.trim().split(" ");
        const metaLast = metaRest.join(" ");
        const firstName =
          prof?.first_name || sUser.user_metadata?.first_name || metaFirst || "Friend";
        const lastName = prof?.last_name || sUser.user_metadata?.last_name || metaLast || "";
        const initials = ((firstName[0] || "U") + (lastName[0] || "")).toUpperCase();
        const role = (prof as { role?: "customer" | "staff" | "admin" } | null)?.role || "customer";
        setUser({ firstName, lastName, email: sUser.email || "", initials, role });
        loadOrders(sUser.id, sUser.email || prof?.email || undefined);
      } else {
        setOrdersLoaded(true);
      }
      setAuthReady(true);
    };

    const cancelSchedule = scheduleIdleTask(() => {
      void initAuth();
    });

    return () => {
      cancelled = true;
      cancelSchedule();
      unsubscribe?.();
    };
  }, [loadOrders]);

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const [cartOpen, setCartOpen] = useState(false);

  // Guards against rapid repeat taps on "Add to cart" (the product page has
  // both a main and a sticky CTA calling this, and a laggy in-app browser
  // with no immediate feedback reliably gets double/triple-tapped) — without
  // this, each extra tap both adds another unit silently and fires another
  // duplicate AddToCart event to Meta.
  const lastAddRef = useRef<Map<string, number>>(new Map());
  const ADD_TO_CART_COOLDOWN_MS = 1500;

  const addToCart = (p: Product, qty = 1, size?: string) => {
    const normalizedSize =
      size || (p.size_options && p.size_options.length > 0 ? p.size_options[0].size : undefined);
    const dedupeKey = `${p.id}::${normalizedSize || ""}`;
    const now = Date.now();
    if (now - (lastAddRef.current.get(dedupeKey) || 0) < ADD_TO_CART_COOLDOWN_MS) return;
    lastAddRef.current.set(dedupeKey, now);

    const unitPrice = getUnitPrice(p, normalizedSize);
    const safeQty = Math.min(MAX_QTY_PER_PRODUCT, Math.max(1, Number(qty) || 1));
    let addedQty = 0;
    let hitLimit = false;

    setCart((c) => {
      const i = c.findIndex((x) => x.id === p.id && x.size === normalizedSize);
      if (i >= 0) {
        const currentQty = Math.max(1, Number(c[i].qty) || 1);
        const nextQty = Math.min(MAX_QTY_PER_PRODUCT, currentQty + safeQty);
        addedQty = Math.max(0, nextQty - currentQty);
        hitLimit = nextQty >= MAX_QTY_PER_PRODUCT;
        if (addedQty === 0) return c;
        return c.map((x, idx) => (idx === i ? { ...x, qty: nextQty } : x));
      }

      const initialQty = Math.min(MAX_QTY_PER_PRODUCT, safeQty);
      addedQty = initialQty;
      hitLimit = initialQty >= MAX_QTY_PER_PRODUCT;
      return [
        ...c,
        { id: p.id, qty: initialQty, ...(normalizedSize ? { size: normalizedSize } : {}) },
      ];
    });

    if (addedQty > 0) {
      trackMetaEvent(
        "AddToCart",
        {
          content_ids: [p.id],
          content_name: p.name,
          content_type: "product",
          content_category: p.category_name || p.cat,
          brand: p.brand,
          num_items: addedQty,
          contents: [{ id: p.id, quantity: addedQty, item_price: toMetaValue(unitPrice) }],
          value: toMetaValue(unitPrice * addedQty),
          currency: "PKR",
        },
        {
          userData: { email: user?.email },
        },
      );
      push(`Added ${p.name} to cart`);
    }

    if (hitLimit) {
      push(`Maximum ${MAX_QTY_PER_PRODUCT} units allowed per product.`);
    }
  };

  const onSignOut = async () => {
    const supabase = await getSupabase();
    await supabase.auth.signOut();
    setUser(null);
    setOrders([]);
    setOrdersLoaded(false);
    push("Signed out");
  };

  const isAdmin = user?.role === "admin" || user?.role === "staff";

  // Load products from database once on mount
  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("active", true)
        .order("sort_order", { ascending: true });

      if (cancelled) return;

      if (!error && data && data.length > 0) {
        setProducts(
          data.map((r: ProductRecord) => ({
            id: r.id,
            name: r.name,
            brand: r.brand,
            cat: r.cat,
            category_name: r.categories?.name ?? undefined,
            price: r.price,
            was: r.was ?? undefined,
            rating: Number(r.rating),
            reviews: r.reviews,
            sales_count: Number(r.sales_count ?? 0),
            stock: r.stock,
            tags: r.tags ?? [],
            blurb: r.blurb,
            swatch: r.swatch,
            image_url: r.image_url ?? undefined,
            size_options: normalizeSizeOptions(
              Array.isArray(r.size_options)
                ? (r.size_options as Array<{ size?: string; price?: number }>)
                : [],
            ),
            variant_options: normalizeVariantOptions(
              Array.isArray(r.variant_options)
                ? (r.variant_options as Array<{ name?: string; price?: number }>)
                : [],
            ),
          })),
        );
      }
      setProductsLoaded(true);
    };

    const cancelSchedule = scheduleIdleTask(() => {
      void loadProducts();
    });

    return () => {
      cancelled = true;
      cancelSchedule();
    };
  }, []);

  // Load categories from database once on mount
  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, sort_order, image_url, top_category")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (cancelled) return;

      if (error) {
        push(error.message || "Failed to load categories", { tone: "red" });
      }

      if (!error && data && data.length > 0) {
        const normalizedCategoryName = (name: string) => {
          if (name.trim().toLowerCase() === "disposible items") return "Disposable Items";
          return name;
        };

        const storefrontCategories: Category[] = [
          { id: "all", name: "All products", count: 0 },
          ...data.map((category: CategoryRecord) => ({
            id: category.slug,
            name: normalizedCategoryName(category.name),
            count: 0,
            image_url: category.image_url,
            top_category: category.top_category,
          })),
        ];
        setCategories(storefrontCategories);
      }

      setCategoriesLoaded(true);
    };

    const cancelSchedule = scheduleIdleTask(() => {
      void loadCategories();
    });

    return () => {
      cancelled = true;
      cancelSchedule();
    };
  }, []);

  return (
    <WcmContext.Provider
      value={{
        theme,
        toggleTheme,
        user,
        isAdmin,
        authReady,
        setUser,
        authOpen,
        setAuthOpen,
        onSignOut,
        cart,
        setCart,
        cartOpen,
        setCartOpen,
        cartCount,
        addToCart,
        wishlist,
        toggleWishlist,
        products,
        productsLoaded,
        categories,
        categoriesLoaded,
        orders,
        setOrders,
        ordersLoaded,
        loadOrders,
        submitOrderReview,
        checkoutData,
        setCheckoutData,
        successOrder,
        setSuccessOrder,
        push,
        Toaster,
      }}
    >
      {children}
    </WcmContext.Provider>
  );
}
