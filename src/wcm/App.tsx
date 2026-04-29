import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Icons, WellcareWordmark, WellcareLogo } from "./icons";
import { useToasts } from "./ui";
import { ProductsPage, ProductDetail } from "./products";
import { CartDrawer, Checkout, type PlacedOrderData } from "./cart";
import { OrdersList, OrderDetail, OrderSuccess } from "./orders";
import { AuthModal, type WcmUser } from "./auth";
import { type Order, type Product } from "./data";

type CartLine = { id: string; qty: number };

export function App(){
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem("wcm-theme") || "light"; } catch { return "light"; }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("wcm-theme", theme); } catch {}
  }, [theme]);
  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  const [user, setUser] = useState<WcmUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const [page, setPage] = useState<"products" | "orders">("products");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [openProd, setOpenProd] = useState<Product | null>(null);
  const [openOrd, setOpenOrd] = useState<Order | null>(null);
  const [checkoutData, setCheckoutData] = useState<{ items: any[]; subtotal: number; shipping: number; total: number } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const { push, Toaster } = useToasts();

  const loadOrders = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error || !data) return;
    setOrders(data.map(r => ({
      id: r.order_code, placed: r.placed, eta: r.eta, status: r.status, progress: r.progress,
      address: r.address, payment: r.payment, items: (r.items as any) || [],
      subtotal: r.subtotal, shipping: r.shipping, total: r.total,
      rider: (r.rider as any) || undefined,
    })));
  }, []);

  // Hydrate session
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const sUser = session?.user;
      if (!sUser) { setUser(null); setOrders([]); return; }
      // defer profile fetch
      setTimeout(async () => {
        const { data: prof } = await supabase.from("profiles").select("first_name,last_name,email").eq("id", sUser.id).maybeSingle();
        const firstName = prof?.first_name || sUser.user_metadata?.first_name || "Friend";
        const lastName = prof?.last_name || sUser.user_metadata?.last_name || "";
        const initials = ((firstName[0] || "U") + (lastName[0] || "")).toUpperCase();
        setUser({ firstName, lastName, email: sUser.email || "", initials });
        loadOrders(sUser.id);
      }, 0);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const sUser = session.user;
        supabase.from("profiles").select("first_name,last_name,email").eq("id", sUser.id).maybeSingle().then(({ data: prof }) => {
          const firstName = prof?.first_name || sUser.user_metadata?.first_name || "Friend";
          const lastName = prof?.last_name || sUser.user_metadata?.last_name || "";
          const initials = ((firstName[0] || "U") + (lastName[0] || "")).toUpperCase();
          setUser({ firstName, lastName, email: sUser.email || "", initials });
          loadOrders(sUser.id);
        });
      }
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [loadOrders]);

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  const addToCart = (p: Product, qty = 1) => {
    setCart(c => {
      const i = c.findIndex(x => x.id === p.id);
      if (i >= 0) return c.map((x, idx) => idx === i ? { ...x, qty: x.qty + qty } : x);
      return [...c, { id: p.id, qty }];
    });
    push(`Added ${p.name} to cart`);
  };

  const goCheckout = (items: any[], subtotal: number, shipping: number, total: number) => {
    if (!user) { setCartOpen(false); setAuthOpen(true); return; }
    setCartOpen(false);
    setCheckoutData({ items, subtotal, shipping, total });
  };

  const placeOrder = async (data: PlacedOrderData) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setAuthOpen(true); return; }
    const id = "WCM-" + (2900 + Math.floor(Math.random()*100));
    const today = new Date();
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month:"short", day:"2-digit", year:"numeric" });
    const eta = new Date(today); eta.setDate(today.getDate() + 1);
    const newOrder: Order = {
      id, placed: fmt(today), eta: fmt(eta),
      status: "Order placed", progress: 0,
      address: `${data.ship.address}, ${data.ship.city}`,
      payment: data.pay,
      items: data.items.map(it => ({ id: it.p.id, qty: it.qty })),
      subtotal: data.subtotal, shipping: data.shipping, total: data.total,
    };
    const { error } = await supabase.from("orders").insert({
      user_id: session.user.id, order_code: id, placed: newOrder.placed, eta: newOrder.eta,
      status: newOrder.status, progress: 0, address: newOrder.address, payment: newOrder.payment,
      items: newOrder.items as any, subtotal: newOrder.subtotal, shipping: newOrder.shipping, total: newOrder.total,
    });
    if (error) { push("Could not place order: " + error.message); return; }
    setOrders(o => [newOrder, ...o]);
    setCart([]);
    setCheckoutData(null);
    setSuccessOrder(newOrder);
  };

  const goTo = (p: "products" | "orders") => { setOpenProd(null); setOpenOrd(null); setPage(p); window.scrollTo(0,0); };

  const onSignOut = async () => { await supabase.auth.signOut(); setUser(null); setOrders([]); push("Signed out"); };

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
      <Header
        page={page} goTo={goTo}
        search={search} setSearch={setSearch}
        cartCount={cartCount} onCartOpen={()=>setCartOpen(true)}
        theme={theme} toggleTheme={toggleTheme}
        user={user} onSignIn={()=>setAuthOpen(true)} onSignOut={onSignOut}
      />
      <main className="wcm-main" style={{ width:"100%", maxWidth:1240, margin:"0 auto", flex:1 }}>
        {page === "products" && !openProd && (
          <ProductsPage
            search={search}
            addToCart={addToCart} openProduct={setOpenProd} cart={cart} goTo={goTo}
          />
        )}
        {page === "products" && openProd && (
          <ProductDetail product={openProd} cart={cart} addToCart={addToCart} onClose={()=>setOpenProd(null)} openProduct={(p)=>{ setOpenProd(null); setTimeout(()=>setOpenProd(p), 0); }}/>
        )}
        {page === "orders" && !openOrd && (
          <OrdersList orders={orders} openOrder={setOpenOrd} goShop={()=>goTo("products")}/>
        )}
        {page === "orders" && openOrd && (
          <OrderDetail order={openOrd} onClose={()=>setOpenOrd(null)}/>
        )}
      </main>
      <Footer/>
      <BottomNav page={page} goTo={goTo} cartCount={cartCount} onCartOpen={()=>setCartOpen(true)}/>

      <CartDrawer
        open={cartOpen} cart={cart} setCart={setCart}
        onClose={()=>setCartOpen(false)} onCheckout={goCheckout}
      />
      {checkoutData && (
        <Checkout
          {...checkoutData}
          user={user}
          onClose={()=>setCheckoutData(null)}
          onPlace={placeOrder}
        />
      )}
      {successOrder && (
        <OrderSuccess
          order={successOrder}
          onClose={()=>setSuccessOrder(null)}
          onView={()=>{
            const o = successOrder;
            setSuccessOrder(null);
            setPage("orders");
            setOpenOrd(orders.find(x => x.id === o.id) || o);
          }}
        />
      )}
      {authOpen && <AuthModal onClose={()=>setAuthOpen(false)} notify={push} onSignIn={(u)=>{ setUser(u); setAuthOpen(false); push(`Welcome, ${u.firstName}!`); }}/>}
      <Toaster/>
    </div>
  );
}

function Header({ page, goTo, search, setSearch, cartCount, onCartOpen, theme, toggleTheme, user, onSignIn, onSignOut }: any){
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <div style={{ background:"var(--grad)", color:"#fff", fontSize:12.5, padding:"7px 14px", textAlign:"center", letterSpacing:0.2 }}>
        🚚 Free same-day delivery in Karachi on orders above Rs 2,000
      </div>
      <header style={{
        position:"sticky", top:0, zIndex:50, background:"var(--header-bg)",
        backdropFilter:"blur(10px)", borderBottom:"1px solid var(--line)"
      }}>
        <div className="wcm-header-pad wcm-header-grid" style={{ width:"100%", maxWidth:1240, margin:"0 auto", display:"grid", alignItems:"center" }}>
          <button onClick={()=>goTo("products")} style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex", alignItems:"center" }}>
            <WellcareWordmark height={24}/>
          </button>

          <div className="wcm-header-mid">
            <div className="wcm-search-wrap">
              <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"var(--ink-4)" }}>{Icons.search}</span>
              <input
                placeholder="Search products…"
                value={search}
                onChange={e=>{ setSearch(e.target.value); if(page!=="products") goTo("products"); }}
                style={{
                  width:"100%", padding:"11px 14px 11px 42px", borderRadius:99,
                  border:"1px solid var(--line)", background:"var(--bg-elev)",
                  fontSize:13.5, fontFamily:"inherit", outline:"none",
                  transition:"border-color .15s, box-shadow .15s"
                }}
                onFocus={e=>{ e.currentTarget.style.borderColor="var(--blue-500)"; e.currentTarget.style.background="var(--card)"; e.currentTarget.style.boxShadow="0 0 0 3px var(--pill-info-bg)"; }}
                onBlur ={e=>{ e.currentTarget.style.borderColor="var(--line)"; e.currentTarget.style.background="var(--bg-elev)"; e.currentTarget.style.boxShadow="none"; }}
              />
            </div>

            <nav className="wcm-nav-desktop" style={{ display:"flex", gap:4 }}>
              <NavBtn active={page==="products"} onClick={()=>goTo("products")} icon={Icons.home}>Shop</NavBtn>
              <NavBtn active={page==="orders"}   onClick={()=>goTo("orders")}   icon={Icons.pkg}>Orders</NavBtn>
            </nav>
          </div>

          <div className="wcm-header-right">
            <ThemeToggle theme={theme} onToggle={toggleTheme}/>
            <button onClick={onCartOpen} aria-label="Cart" className="wcm-desktop-only" style={{ ...iconBtn, position:"relative" }}>
              {Icons.cart}
              {cartCount > 0 && <CartBadge n={cartCount}/>}
            </button>
            {user ? (
              <div style={{ position:"relative" }}>
                <button onClick={()=>setMenuOpen((o: boolean)=>!o)} style={{
                  display:"flex", alignItems:"center", gap:8, padding:"4px 10px 4px 4px", borderRadius:99,
                  border:"1px solid var(--line)", background:"var(--card)", cursor:"pointer", fontFamily:"inherit"
                }}>
                  <div style={{ width:30, height:30, borderRadius:99, background:"var(--grad)", color:"#fff", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800 }}>{user.initials}</div>
                  <span className="wcm-user-name" style={{ fontSize:13, fontWeight:700, color:"var(--ink-2)" }}>{user.firstName}</span>
                </button>
                {menuOpen && (
                  <>
                    <div onClick={()=>setMenuOpen(false)} style={{ position:"fixed", inset:0, zIndex:60 }}/>
                    <div style={{
                      position:"absolute", right:0, top:"calc(100% + 8px)", zIndex:61, minWidth:240,
                      background:"var(--card)", border:"1px solid var(--line)", borderRadius:14,
                      boxShadow:"var(--shadow-lg)", overflow:"hidden"
                    }}>
                      <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--line)" }}>
                        <div style={{ fontSize:14, fontWeight:800, color:"var(--ink)" }}>{user.firstName} {user.lastName}</div>
                        <div style={{ fontSize:12, color:"var(--ink-4)", marginTop:2 }}>{user.email}</div>
                      </div>
                      <button onClick={()=>{ setMenuOpen(false); goTo("orders"); }} style={menuItem}>{Icons.pkg} My orders</button>
                      <button style={menuItem}>{Icons.user} Account settings</button>
                      <button style={menuItem}>{Icons.heart} Saved items</button>
                      <div style={{ height:1, background:"var(--line)" }}/>
                      <button onClick={()=>{ setMenuOpen(false); onSignOut(); }} style={{ ...menuItem, color:"var(--pill-rose-fg)" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button onClick={onSignIn} style={{
                display:"inline-flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:99,
                background:"var(--grad)", color:"#fff", border:"none", cursor:"pointer",
                fontWeight:700, fontSize:13, fontFamily:"inherit", whiteSpace:"nowrap",
                boxShadow:"0 6px 14px -6px rgba(37,99,235,.4)"
              }}>
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
  <span style={{
    position:"absolute", top:-4, right:-4, minWidth:18, height:18, padding:"0 5px",
    borderRadius:99, background:"var(--green-500)", color:"#fff",
    fontSize:10.5, fontWeight:800, display:"inline-flex", alignItems:"center", justifyContent:"center",
    border:"2px solid var(--card)"
  }}>{n}</span>
);

const menuItem: React.CSSProperties = {
  display:"flex", alignItems:"center", gap:10, width:"100%",
  padding:"11px 16px", border:"none", background:"transparent",
  color:"var(--ink-2)", fontSize:13.5, fontWeight:600, cursor:"pointer",
  textAlign:"left", fontFamily:"inherit"
};

function NavBtn({ active, onClick, children, icon }: any){
  return (
    <button onClick={onClick} style={{
      display:"inline-flex", alignItems:"center", gap:7, padding:"9px 14px",
      borderRadius:99, background: active ? "var(--ink)" : "transparent",
      color: active ? "var(--card)" : "var(--ink-2)", border:"none", cursor:"pointer",
      fontWeight:700, fontSize:13.5, fontFamily:"inherit"
    }}>
      <span style={{ display:"inline-flex" }}>{icon}</span> {children}
    </button>
  );
}

function BottomNav({ page, goTo, cartCount, onCartOpen }: any){
  const items = [
    { id:"products", label:"Shop", icon:Icons.home, action:()=>goTo("products") },
    { id:"cart", label:"Cart", icon:Icons.cart, action:onCartOpen, badge: cartCount },
    { id:"orders", label:"Orders", icon:Icons.pkg, action:()=>goTo("orders") },
  ];
  return (
    <nav className="wcm-bottomnav">
      {items.map(it => {
        const active = it.id === page;
        return (
          <button key={it.id} onClick={it.action} style={{
            position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:2,
            padding:"6px 14px", border:"none", background:"transparent",
            color: active ? "var(--blue-700)" : "var(--ink-3)",
            fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit", minWidth:60
          }}>
            <span style={{ position:"relative" }}>
              {it.icon}
              {(it.badge ?? 0) > 0 && <CartBadge n={it.badge as number}/>}
            </span>
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: string; onToggle: () => void }){
  const dark = theme === "dark";
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
      style={{
        position:"relative", width:54, height:30, borderRadius:99,
        border:"1px solid var(--line)",
        background: dark ? "linear-gradient(135deg, #0f172a, #1e293b)" : "linear-gradient(135deg, #f0f9ff, #fef9c3)",
        cursor:"pointer", padding:0, transition:"background .25s ease",
        boxShadow:"inset 0 1px 2px rgba(0,0,0,.1)", flexShrink:0
      }}
    >
      <span style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", color: dark ? "rgba(255,255,255,.35)" : "#f59e0b", display:"inline-flex" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      </span>
      <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", color: dark ? "#cbd5e1" : "rgba(15,23,42,.25)", display:"inline-flex" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"/></svg>
      </span>
      <span style={{
        position:"absolute", top:3, left: dark ? 27 : 3,
        width:22, height:22, borderRadius:99,
        background: dark ? "linear-gradient(135deg, #1e293b, #334155)" : "#fff",
        boxShadow:"0 2px 6px rgba(0,0,0,.25), 0 1px 2px rgba(0,0,0,.15)",
        transition:"left .25s cubic-bezier(.4,.7,.3,1.3), background .25s"
      }}/>
    </button>
  );
}

const iconBtn: React.CSSProperties = {
  width:38, height:38, borderRadius:99, border:"1px solid var(--line)",
  background:"var(--card)", color:"var(--ink-2)", cursor:"pointer",
  display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0
};

function Footer(){
  return (
    <footer style={{ background:"var(--card)", borderTop:"1px solid var(--line)", marginTop:"auto" }}>
      <div className="wcm-footer-cols" style={{ width:"100%", maxWidth:1240, margin:"0 auto", padding:"30px 24px 24px", display:"grid" }}>
        <div>
          <WellcareWordmark height={22}/>
          <p style={{ marginTop:14, color:"var(--ink-4)", fontSize:13, lineHeight:1.6, maxWidth:340 }}>
            Wellcare Mart is your trusted online destination for reliable home healthcare — from daily monitoring to mobility, delivered to your door.
          </p>
        </div>
        {[
          { h:"Shop", links:["Monitoring","Mobility","Respiratory","Therapy","Disposables"] },
          { h:"Help", links:["Track an order","Returns & refunds","Shipping","Contact us","FAQs"] },
          { h:"Company", links:["About Wellcare","Brand partners","Careers","Privacy","Terms"] },
        ].map(col => (
          <div key={col.h}>
            <div style={{ fontSize:12, fontWeight:800, letterSpacing:0.4, color:"var(--ink-3)", textTransform:"uppercase", marginBottom:10 }}>{col.h}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {col.links.map(l => <a key={l} href="#" onClick={e=>e.preventDefault()} style={{ color:"var(--ink-2)", textDecoration:"none", fontSize:13.5, fontWeight:600 }}>{l}</a>)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop:"1px solid var(--line-2)", padding:"14px 24px", textAlign:"center", color:"var(--ink-4)", fontSize:12 }}>
        © 2026 Wellcare Mart · Your Health, Our Care
      </div>
    </footer>
  );
}
