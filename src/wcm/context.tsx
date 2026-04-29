import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToasts } from "./ui";
import type { WcmUser } from "./auth";
import { PRODUCTS, type Product, type Order } from "./data";

export type CartLine = { id: string; qty: number };
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
  addToCart: (p: Product, qty?: number) => void;
  // Wishlist
  wishlist: string[];
  toggleWishlist: (id: string) => void;
  // Products
  products: Product[];
  productsLoaded: boolean;
  // Orders
  orders: Order[];
  setOrders: Dispatch<SetStateAction<Order[]>>;
  ordersLoaded: boolean;
  loadOrders: (userId: string) => Promise<void>;
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
  const [authOpen, setAuthOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("wcm-cart");
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("wcm-cart", JSON.stringify(cart));
    } catch {}
  }, [cart]);

  const [wishlist, setWishlist] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("wcm-wishlist");
      if (saved) setWishlist(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("wcm-wishlist", JSON.stringify(wishlist));
    } catch {}
  }, [wishlist]);

  const toggleWishlist = (id: string) => {
    setWishlist((w) => {
      const next = w.includes(id) ? w.filter((x) => x !== id) : [...w, id];
      push(next.includes(id) ? "Added to saved items" : "Removed from saved items");
      return next;
    });
  };
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [checkoutData, setCheckoutData] = useState<CheckoutState | null>(null);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const { push, Toaster } = useToasts();

  const loadOrders = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setOrdersLoaded(true);
    if (error || !data) return;
    setOrders(
      data.map((r) => ({
        id: r.order_code,
        placed: r.placed,
        eta: r.eta,
        status: r.status,
        progress: r.progress,
        address: r.address,
        payment: r.payment,
        items: (r.items as any) || [],
        subtotal: r.subtotal,
        shipping: r.shipping,
        total: r.total,
        rider: (r.rider as any) || undefined,
      })),
    );
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
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
        const firstName = prof?.first_name || sUser.user_metadata?.first_name || "Friend";
        const lastName = prof?.last_name || sUser.user_metadata?.last_name || "";
        const initials = ((firstName[0] || "U") + (lastName[0] || "")).toUpperCase();
        const role = (prof as { role?: "customer" | "staff" | "admin" } | null)?.role || "customer";
        setUser({ firstName, lastName, email: sUser.email || "", initials, role });
        loadOrders(sUser.id);
      }, 0);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const sUser = session.user;
        supabase
          .from("profiles")
          .select("first_name,last_name,email,role")
          .eq("id", sUser.id)
          .maybeSingle()
          .then(({ data: prof }) => {
            const firstName = prof?.first_name || sUser.user_metadata?.first_name || "Friend";
            const lastName = prof?.last_name || sUser.user_metadata?.last_name || "";
            const initials = ((firstName[0] || "U") + (lastName[0] || "")).toUpperCase();
            const role =
              (prof as { role?: "customer" | "staff" | "admin" } | null)?.role || "customer";
            setUser({ firstName, lastName, email: sUser.email || "", initials, role });
            loadOrders(sUser.id);
          });
      } else {
        setOrdersLoaded(true);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadOrders]);

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const [cartOpen, setCartOpen] = useState(false);

  const addToCart = (p: Product, qty = 1) => {
    setCart((c) => {
      const i = c.findIndex((x) => x.id === p.id);
      if (i >= 0) return c.map((x, idx) => (idx === i ? { ...x, qty: x.qty + qty } : x));
      return [...c, { id: p.id, qty }];
    });
    push(`Added ${p.name} to cart`);
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setOrders([]);
    setOrdersLoaded(false);
    push("Signed out");
  };

  const isAdmin = user?.role === "admin" || user?.role === "staff";

  // Load products from database once on mount
  useEffect(() => {
    (supabase as any)
      .from("products")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }: { data: any[] | null; error: any }) => {
        if (!error && data && data.length > 0) {
          setProducts(
            data.map((r) => ({
              id: r.id,
              name: r.name,
              brand: r.brand,
              cat: r.cat,
              price: r.price,
              was: r.was ?? undefined,
              rating: Number(r.rating),
              reviews: r.reviews,
              stock: r.stock,
              tags: r.tags ?? [],
              blurb: r.blurb,
              swatch: r.swatch,
              image_url: r.image_url ?? undefined,
            })),
          );
        }
        setProductsLoaded(true);
      });
  }, []);

  return (
    <WcmContext.Provider
      value={{
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
        addToCart,
        wishlist,
        toggleWishlist,
        products,
        productsLoaded,
        orders,
        setOrders,
        ordersLoaded,
        loadOrders,
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
