import React, { useEffect, useState } from "react";
import {
  PRODUCTS,
  PKR,
  getUnitPrice,
  computeShipping,
  isKarachiCity,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_COST,
  PAKISTAN_CITIES,
  type Product,
} from "./data";
import { Icons } from "./icons";
import { ProductImage, Btn, TextField, Section, Row, Select, useToasts } from "./ui";
import type { SelectOption } from "./ui";

type CartLine = { id: string; qty: number; size?: string };
type CartItem = CartLine & { p: Product };
const MAX_QTY_PER_PRODUCT = 5;
const CITY_OPTIONS: SelectOption[] = PAKISTAN_CITIES.map((city) => ({ value: city, label: city }));

export type CheckoutData = {
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
};

export type PlacedOrderData = CheckoutData & {
  ship: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    landmark: string;
  };
  pay: string;
  promo_code?: string;
};

export function CartDrawer({
  open,
  cart,
  products: liveProducts,
  setCart,
  onClose,
  onCheckout,
}: {
  open: boolean;
  cart: CartLine[];
  products?: Product[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  onClose: () => void;
  onCheckout: (items: CartItem[], subtotal: number, shipping: number, total: number) => void;
}) {
  const isMobile = useIsMobile();
  const mobileBottomNavInset = "calc(env(safe-area-inset-bottom, 0px) + 58px)";

  if (!open) return null;
  const catalog = liveProducts && liveProducts.length > 0 ? liveProducts : PRODUCTS;
  const items: CartItem[] = cart
    .map((c) => ({ ...c, p: catalog.find((p) => p.id === c.id) as Product }))
    .filter((x) => x.p);
  const subtotal = items.reduce((s, x) => s + getUnitPrice(x.p, x.size) * x.qty, 0);
  // The delivery city isn't known until checkout, so show the Karachi estimate
  // here (the advertised offer). Checkout recomputes this from the entered city.
  const shipping = computeShipping(subtotal, "Karachi");
  const total = subtotal + shipping;
  const update = (id: string, size: string | undefined, qty: number) =>
    setCart((c) =>
      qty <= 0
        ? c.filter((x) => !(x.id === id && x.size === size))
        : c.map((x) =>
            x.id === id && x.size === size
              ? { ...x, qty: Math.min(MAX_QTY_PER_PRODUCT, Math.max(1, qty)) }
              : x,
          ),
    );

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: isMobile ? mobileBottomNavInset : 0,
          background: "var(--overlay)",
          zIndex: 90,
          animation: "fadeIn .2s ease",
        }}
      />
      <aside
        className="wcm-cart-drawer"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: isMobile ? mobileBottomNavInset : 0,
          height: isMobile ? `calc(100vh - ${mobileBottomNavInset})` : "100vh",
          width: "30vw",
          maxWidth: "96vw",
          background: "var(--card)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-20px 0 60px -20px rgba(0,0,0,.3)",
          animation: "slideIn .25s ease",
          overflow: "hidden",
        }}
      >
        <style>{`
          @keyframes fadeIn{from{opacity:0}to{opacity:1}}
          @keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
        `}</style>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "var(--grad-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--blue-700)",
              }}
            >
              {Icons.cart}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Your cart</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                {items.length} {items.length === 1 ? "item" : "items"}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--card)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {Icons.close}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 22px" }}>
          {items.length === 0 ? (
            <div style={{ padding: "40px 12px", textAlign: "center", color: "var(--ink-4)" }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 18,
                  background: "var(--grad-soft)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--blue-700)",
                  marginBottom: 10,
                }}
              >
                {Icons.cart}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-2)" }}>
                Your cart is empty
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Browse products and add care essentials.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map(({ p, qty, size }) => (
                <div
                  key={`${p.id}-${size || "default"}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "68px 1fr auto",
                    gap: 12,
                    alignItems: "center",
                    padding: 10,
                    border: "1px solid var(--line)",
                    borderRadius: 14,
                    background: "var(--card)",
                  }}
                >
                  <div style={{ width: 68, height: 68, borderRadius: 10, overflow: "hidden" }}>
                    <ProductImage product={p} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 600 }}>
                      {p.brand}
                    </div>
                    {size && (
                      <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>
                        Selection: {size}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--ink)",
                        lineHeight: 1.25,
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <div
                        style={{
                          display: "inline-flex",
                          border: "1px solid var(--line)",
                          borderRadius: 10,
                          overflow: "hidden",
                        }}
                      >
                        <button onClick={() => update(p.id, size, qty - 1)} style={miniBtn}>
                          {Icons.minus}
                        </button>
                        <div
                          style={{
                            minWidth: 30,
                            textAlign: "center",
                            fontWeight: 700,
                            fontSize: 13,
                            lineHeight: "30px",
                          }}
                        >
                          {qty}
                        </div>
                        <button
                          onClick={() => update(p.id, size, qty + 1)}
                          style={{ ...miniBtn, opacity: qty >= MAX_QTY_PER_PRODUCT ? 0.5 : 1 }}
                          disabled={qty >= MAX_QTY_PER_PRODUCT}
                        >
                          {Icons.plus}
                        </button>
                      </div>
                      <button
                        onClick={() => update(p.id, size, 0)}
                        aria-label="Remove"
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          border: "1px solid var(--line)",
                          background: "var(--card)",
                          color: "var(--ink-4)",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {Icons.trash}
                      </button>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontWeight: 800, fontSize: 14 }}>
                    {PKR(getUnitPrice(p, size) * qty)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            borderTop: "1px solid var(--line)",
            padding: "16px 22px",
            background: "var(--card-2)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
            <Row label="Subtotal" value={PKR(subtotal)} />
            <Row
              label="Delivery"
              value={
                shipping === 0 ? (
                  <span style={{ color: "var(--pill-success-fg)", fontWeight: 700 }}>Free</span>
                ) : (
                  PKR(shipping)
                )
              }
            />
            <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
            <Row
              label={<span style={{ fontWeight: 800, fontSize: 15 }}>Total</span>}
              value={<span style={{ fontWeight: 800, fontSize: 18 }}>{PKR(total)}</span>}
            />
          </div>
          {subtotal > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                background: "var(--surface)",
                borderRadius: 10,
                border: "1px solid var(--line)",
              }}
            >
              {subtotal >= FREE_SHIPPING_THRESHOLD ? (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--pill-success-fg)",
                    marginBottom: 6,
                  }}
                >
                  <span aria-hidden="true">🎉</span> Free delivery in Karachi unlocked!
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-2)",
                    marginBottom: 6,
                  }}
                >
                  Add {PKR(FREE_SHIPPING_THRESHOLD - subtotal)} more for free delivery in Karachi
                </div>
              )}
              <div
                style={{
                  height: 5,
                  background: "var(--line)",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100))}%`,
                    background:
                      subtotal >= FREE_SHIPPING_THRESHOLD
                        ? "var(--pill-success-fg)"
                        : "var(--grad)",
                    borderRadius: 999,
                    transition: "width .4s ease",
                  }}
                />
              </div>
            </div>
          )}
          <Btn
            full
            size="lg"
            disabled={items.length === 0}
            onClick={() => onCheckout(items, subtotal, shipping, total)}
            style={{ marginTop: 12 }}
            iconRight={Icons.chev}
          >
            Checkout · {PKR(total)}
          </Btn>
        </div>
      </aside>
    </>
  );
}

const miniBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--card)",
  border: "none",
  color: "var(--ink-2)",
  cursor: "pointer",
};

import { useIsMobile } from "@/hooks/use-mobile";

export function CheckoutContent({
  items,
  subtotal,
  shipping,
  total,
  user,
  onClose,
  onPlace,
  placing = false,
}: CheckoutData & {
  user: { firstName: string; lastName: string; email: string; initials: string } | null;
  onClose: () => void;
  onPlace: (d: PlacedOrderData) => void;
  placing?: boolean;
}) {
  const [step, setStep] = useState(1);
  const isMobile = useIsMobile();
  const { push } = useToasts();
  // Scroll to top on mobile when moving to step 2 or 3
  React.useEffect(() => {
    if (isMobile && (step === 2 || step === 3)) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step, isMobile]);
  const fullName = user ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}` : "";
  const [ship, setShip] = useState({
    name: fullName,
    phone: "",
    email: user ? user.email : "",
    address: "",
    city: "Karachi",
    landmark: "",
  });
  const [pay, setPay] = useState<"cod" | "bank">("cod");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [promo, setPromo] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoErr, setPromoErr] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoShake, setPromoShake] = useState(false);
  const [copiedBankField, setCopiedBankField] = useState<"account" | "iban" | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<string[]>([]);
  const PROMOS: Record<string, number> = { WELLCARE10: 0.1, HEALTH20: 0.2, CARE15: 0.15 };
  const discountPct = promoApplied ? (PROMOS[promo.trim().toUpperCase()] ?? 0) : 0;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("wcm_saved_addresses");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setSavedAddresses(parsed.filter((x) => typeof x === "string"));
    } catch {
      // ignore invalid local storage payload
    }
  }, []);
  const discountAmt = Math.round(subtotal * discountPct);
  // Recompute delivery from the entered city so it stays in sync with what the
  // server actually charges: free only for Karachi orders over the threshold.
  // The `shipping` prop from the cart is just a pre-address estimate.
  const effectiveShipping = computeShipping(subtotal, ship.city);
  const freeDeliveryMissedForCity =
    effectiveShipping > 0 && subtotal >= FREE_SHIPPING_THRESHOLD && !isKarachiCity(ship.city);
  const finalTotal = Math.max(0, subtotal + effectiveShipping - discountAmt);

  const applyPromo = () => {
    if (!promo.trim()) return;
    setPromoLoading(true);
    setPromoErr("");
    window.setTimeout(() => {
      const code = promo.trim().toUpperCase();
      if (PROMOS[code]) {
        setPromoApplied(true);
        setPromoErr("");
        push(`Promo code applied — ${Math.round(PROMOS[code] * 100)}% off!`, { tone: "green" });
      } else {
        setPromoErr("Invalid or expired promo code");
        setPromoApplied(false);
        setPromoShake(true);
        push("That promo code isn't valid", { tone: "red" });
        window.setTimeout(() => setPromoShake(false), 500);
      }
      setPromoLoading(false);
    }, 500);
  };

  const validateShip = () => {
    const e: Record<string, string> = {};
    if (!ship.name.trim()) e.name = "Required";
    if (!/^\+?\d[\d\s]{8,}$/.test(ship.phone)) e.phone = "Enter a valid phone";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ship.email.trim())) e.email = "Enter a valid email";
    if (!ship.address.trim()) e.address = "Required";
    if (!ship.city.trim()) e.city = "Required";
    setErrs(e);
    const firstKey = Object.keys(e)[0];
    if (firstKey) {
      window.setTimeout(() => {
        document
          .getElementById(`field-${firstKey}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 1 && !validateShip()) return;
    setStep((s) => s + 1);
  };

  const payLabel = pay === "cod" ? "Cash on delivery" : "Bank transfer";

  const copyBankValue = async (field: "account" | "iban", value: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        push("Couldn't copy — please copy manually", { tone: "red" });
        return;
      }
      await navigator.clipboard.writeText(value);
      setCopiedBankField(field);
      push("Copied to clipboard");
      window.setTimeout(() => {
        setCopiedBankField((prev) => (prev === field ? null : prev));
      }, 1200);
    } catch {
      push("Couldn't copy — please copy manually", { tone: "red" });
    }
  };

  const place = () => {
    const compactAddress = `${ship.address}, ${ship.city}`.trim();
    if (compactAddress.length > 3) {
      const next = [compactAddress, ...savedAddresses.filter((x) => x !== compactAddress)].slice(
        0,
        4,
      );
      setSavedAddresses(next);
      localStorage.setItem("wcm_saved_addresses", JSON.stringify(next));
      push("Address saved for next time");
    }

    onPlace({
      ship,
      pay: payLabel,
      items,
      subtotal,
      shipping: effectiveShipping,
      total: finalTotal,
      promo_code: promoApplied ? promo.trim().toUpperCase() : undefined,
    });
  };

  return (
    <div
      style={{
        background: "var(--bg)",
        borderRadius: 20,
        width: "100%",
        maxWidth: 980,
        margin: isMobile ? "0 auto 32px" : "32px auto",
        minHeight: isMobile ? undefined : "calc(100vh - 240px)",
        display: "flex",
        flexDirection: "column",
        boxShadow: "var(--shadow-lg)",
        border: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 22px",
          background: "var(--card)",
          borderBottom: "1px solid var(--line)",
          position: "sticky",
          top: 0,
          zIndex: 10,
          borderRadius: "20px 20px 0 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.2 }}>Checkout</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {[1, 2, 3].map((n) => (
              <React.Fragment key={n}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: step >= n ? "var(--grad)" : "var(--chip)",
                    color: step >= n ? "#fff" : "var(--ink-4)",
                    transition: "all .2s",
                  }}
                >
                  {step > n ? "✓" : n}
                </div>
                {n < 3 && (
                  <div
                    style={{
                      width: 32,
                      height: 2,
                      background: step > n ? "var(--green-500)" : "var(--line)",
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="wcm-co-step-label">
            {step === 1 ? "Delivery details" : step === 2 ? "Payment" : "Review & place order"}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--card)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {Icons.close}
        </button>
      </div>

      <div
        className="wcm-checkout-cols"
        style={{
          display: "grid",
          gap: 0,
          flex: isMobile ? undefined : 1,
          overflow: isMobile ? undefined : "hidden",
        }}
      >
        <div style={{ padding: 24, overflowY: isMobile ? undefined : "auto" }}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: -0.2 }}>
                Where should we deliver?
              </h3>
              {savedAddresses.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--ink-3)",
                      letterSpacing: 0.2,
                    }}
                  >
                    QUICK FILL
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {savedAddresses.map((address) => (
                      <button
                        key={address}
                        onClick={() => {
                          const [street, city] = address.split(",").map((x) => x.trim());
                          setShip({ ...ship, address: street || address, city: city || ship.city });
                        }}
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
                        {address}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div
                className="wcm-form-2"
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
              >
                <TextField
                  id="field-name"
                  label="Full name"
                  value={ship.name}
                  onChange={(e) => setShip({ ...ship, name: e.target.value })}
                  error={errs.name}
                />
                <TextField
                  id="field-phone"
                  label="Phone number"
                  value={ship.phone}
                  onChange={(e) => setShip({ ...ship, phone: e.target.value })}
                  error={errs.phone}
                />
              </div>
              <TextField
                id="field-email"
                label="Email"
                value={ship.email}
                onChange={(e) => {
                  setShip({ ...ship, email: e.target.value });
                  if (errs.email) setErrs({ ...errs, email: "" });
                }}
                onBlur={() => {
                  if (ship.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ship.email.trim())) {
                    setErrs((prev) => ({ ...prev, email: "Enter a valid email" }));
                  }
                }}
                error={errs.email}
                hint="Required for order confirmation and tracking updates."
              />
              <TextField
                id="field-address"
                label="Street address"
                value={ship.address}
                onChange={(e) => setShip({ ...ship, address: e.target.value })}
                error={errs.address}
              />
              <div
                className="wcm-form-2"
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
              >
                <div id="field-city" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--ink-3)",
                      letterSpacing: 0.2,
                    }}
                  >
                    City
                  </span>
                  <Select
                    full
                    searchable
                    searchPlaceholder="Search city…"
                    emptyLabel="No matching city"
                    value={ship.city}
                    placeholder="Select city"
                    options={CITY_OPTIONS}
                    onChange={(city) => {
                      setShip({ ...ship, city });
                      if (errs.city) setErrs({ ...errs, city: "" });
                    }}
                    style={{
                      padding: "11px 14px",
                      borderRadius: 11,
                      border: `1px solid ${errs.city ? "var(--pill-rose-fg)" : "var(--line)"}`,
                      background: "var(--card)",
                      color: "var(--ink)",
                      fontSize: 14,
                      boxShadow: errs.city ? "0 0 0 3px var(--pill-rose-bg)" : "none",
                    }}
                  />
                  {errs.city && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pill-rose-fg)" }}>
                      {errs.city}
                    </span>
                  )}
                </div>
                <TextField
                  label="Landmark (optional)"
                  value={ship.landmark}
                  onChange={(e) => setShip({ ...ship, landmark: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                <DeliveryOption
                  selected
                  title="Standard delivery 2–3 days"
                  sub={`Across Pakistan via BlueEx · ${effectiveShipping === 0 ? "Free" : PKR(effectiveShipping)}`}
                  right={effectiveShipping === 0 ? "Free" : PKR(effectiveShipping)}
                />
                {freeDeliveryMissedForCity && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--blue-700)",
                      background: "var(--pill-info-bg)",
                      borderRadius: 10,
                      padding: "8px 12px",
                    }}
                  >
                    Free delivery is available on Karachi orders over {PKR(FREE_SHIPPING_THRESHOLD)}
                    . A {PKR(SHIPPING_COST)} delivery fee applies to{" "}
                    {ship.city.trim() || "this city"}.
                  </div>
                )}
              </div>
            </div>
          )}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: -0.2 }}>
                How would you like to pay?
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <PayOption
                  selected={pay === "cod"}
                  onClick={() => setPay("cod")}
                  icon={Icons.cash}
                  title="Cash on delivery"
                  sub="Pay when your order arrives"
                />
                <PayOption
                  selected={pay === "bank"}
                  onClick={() => setPay("bank")}
                  icon={Icons.card}
                  title="Bank transfer"
                  sub="Transfer before dispatch · account details below"
                />
              </div>
              {pay === "bank" && (
                <Section style={{ padding: 18, marginTop: 2 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--ink-4)",
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                      marginBottom: 10,
                    }}
                  >
                    Bank account details
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                    {[
                      ["Bank", "MCB Islamic Bank"],
                      ["Account title", "DROXLABS LLP"],
                      ["Account number", "2691006549640001"],
                      ["Branch", "Electronic Market Branch"],
                      ["Branch code", "269"],
                      ["IBAN", "PK92MCIB2691006549640001"],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ color: "var(--ink-4)", fontWeight: 600, minWidth: 130 }}>
                          {label}
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontWeight: 700,
                            fontFamily: "monospace",
                          }}
                        >
                          {value}
                          {(label === "Account number" || label === "IBAN") && (
                            <button
                              type="button"
                              onClick={() =>
                                copyBankValue(label === "IBAN" ? "iban" : "account", value)
                              }
                              aria-label={`Copy ${label}`}
                              title={
                                copiedBankField === (label === "IBAN" ? "iban" : "account")
                                  ? "Copied"
                                  : `Copy ${label}`
                              }
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 6,
                                border: "1px solid var(--line)",
                                background: "var(--card)",
                                color:
                                  copiedBankField === (label === "IBAN" ? "iban" : "account")
                                    ? "var(--green-700)"
                                    : "var(--ink-3)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                padding: 0,
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  transform: "scale(0.72)",
                                  lineHeight: 0,
                                }}
                              >
                                {Icons.copy}
                              </span>
                            </button>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      padding: "9px 12px",
                      borderRadius: 10,
                      background: "var(--pill-info-bg)",
                      color: "var(--blue-700)",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Please include your phone number or name as the transfer reference.
                  </div>
                </Section>
              )}
            </div>
          )}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: -0.2 }}>
                Review your order
              </h3>
              <Section style={{ padding: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--ink-4)",
                        fontWeight: 700,
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                      }}
                    >
                      Deliver to
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>{ship.name}</div>
                    <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5 }}>
                      {ship.address}, {ship.city}
                      {ship.landmark ? ` · ${ship.landmark}` : ""}
                      <br />
                      {ship.phone}
                    </div>
                  </div>
                  <button onClick={() => setStep(1)} style={editLink}>
                    Edit
                  </button>
                </div>
              </Section>
              <Section style={{ padding: 16 }}>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--ink-4)",
                      fontWeight: 700,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                    }}
                  >
                    Payment
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>{payLabel}</div>
                </div>
              </Section>
              <Section style={{ padding: 16 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--ink-4)",
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  Items ({items.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map(({ p, qty, size }) => (
                    <div
                      key={`${p.id}-${size || "default"}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "44px 1fr auto",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden" }}>
                        <ProductImage product={p} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                          Qty {qty}
                          {size ? ` · Selection ${size}` : ""}
                          {p.brand ? ` · ${p.brand}` : ""}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {PKR(getUnitPrice(p, size) * qty)}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}
        </div>

        <div
          className="wcm-co-summary"
          style={{
            padding: 24,
            background: "var(--card)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--ink-4)",
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Order summary
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {items.map(({ p, qty, size }) => (
              <div
                key={`${p.id}-${size || "default"}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  fontSize: 13,
                }}
              >
                <span style={{ color: "var(--ink-2)", flex: 1 }}>
                  {p.name}
                  {size ? <span style={{ color: "var(--ink-4)" }}>{` (${size})`}</span> : null}
                  <span style={{ color: "var(--ink-4)" }}> × {qty}</span>
                </span>
                <span style={{ fontWeight: 700 }}>{PKR(getUnitPrice(p, size) * qty)}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: "var(--line)", margin: "4px 0 12px" }} />
          <Row label="Subtotal" value={PKR(subtotal)} />
          <div style={{ height: 6 }} />
          <Row
            label="Delivery"
            value={
              effectiveShipping === 0 ? (
                <span style={{ color: "var(--pill-success-fg)", fontWeight: 700 }}>Free</span>
              ) : (
                PKR(effectiveShipping)
              )
            }
          />
          <div style={{ height: 6 }} />
          <Row label="Tax" value={<span style={{ color: "var(--ink-4)" }}>Included</span>} />
          {discountAmt > 0 && (
            <>
              <div style={{ height: 6 }} />
              <Row
                label={
                  <span style={{ color: "var(--pill-success-fg)", fontWeight: 700 }}>
                    Promo ({Math.round(discountPct * 100)}% off)
                  </span>
                }
                value={
                  <span style={{ color: "var(--pill-success-fg)", fontWeight: 700 }}>
                    -{PKR(discountAmt)}
                  </span>
                }
              />
            </>
          )}
          <div style={{ height: 1, background: "var(--line)", margin: "12px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.4 }}>
              {PKR(finalTotal)}
            </span>
          </div>
          <style>{`@keyframes wcmPromoShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}`}</style>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <div
              style={{
                flex: 1,
                position: "relative",
                animation: promoShake ? "wcmPromoShake .45s ease" : undefined,
              }}
            >
              <input
                placeholder="Promo code"
                value={promo}
                onChange={(e) => {
                  setPromo(e.target.value);
                  setPromoApplied(false);
                  setPromoErr("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !promoApplied && !promoLoading) applyPromo();
                }}
                disabled={promoApplied || promoLoading}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: `1px solid ${promoErr ? "var(--pill-rose-fg)" : promoApplied ? "var(--green-500)" : "var(--line)"}`,
                  background: "var(--bg-elev)",
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                  color: promoApplied ? "var(--pill-success-fg)" : "var(--ink)",
                  boxShadow: promoErr ? "0 0 0 3px var(--pill-rose-bg)" : undefined,
                  transition: "border-color .2s, box-shadow .2s",
                }}
              />
              {promoErr && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--pill-rose-fg)",
                    marginTop: 4,
                  }}
                >
                  {promoErr}
                </div>
              )}
              {promoApplied && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--pill-success-fg)",
                    marginTop: 4,
                  }}
                >
                  ✓ Applied!
                </div>
              )}
            </div>
            <button
              onClick={
                promoApplied
                  ? () => {
                      setPromoApplied(false);
                      setPromo("");
                      setPromoErr("");
                    }
                  : applyPromo
              }
              disabled={promoLoading || (!promoApplied && !promo.trim())}
              style={{
                padding: "9px 14px",
                borderRadius: 10,
                border: "1px solid var(--line)",
                background: promoApplied ? "var(--pill-success-bg)" : "var(--card)",
                color: promoApplied ? "var(--pill-success-fg)" : "var(--ink-2)",
                fontWeight: 700,
                fontSize: 13,
                cursor:
                  promoLoading || (!promoApplied && !promo.trim()) ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                opacity: promoLoading || (!promoApplied && !promo.trim()) ? 0.6 : 1,
                transition: "opacity .15s",
                minWidth: 66,
              }}
            >
              {promoLoading ? "…" : promoApplied ? "Remove" : "Apply"}
            </button>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            {step > 1 && (
              <Btn variant="outline" onClick={() => setStep((s) => s - 1)} icon={Icons.chevL}>
                Back
              </Btn>
            )}
            {step < 3 ? (
              <Btn full size="lg" onClick={next} iconRight={Icons.chev}>
                Continue
              </Btn>
            ) : (
              <Btn full size="lg" onClick={place} icon={Icons.check} disabled={placing}>
                {placing ? "Placing order…" : `Place order · ${PKR(finalTotal)}`}
              </Btn>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-4)", textAlign: "center", marginTop: 10 }}>
            By placing this order, you agree to Wellcare Mart's terms.
          </div>
        </div>
      </div>
    </div>
  );
}

const editLink: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--blue-700)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  padding: 0,
};

function DeliveryOption({
  title,
  sub,
  right,
  selected,
  onClick,
}: {
  title: string;
  sub: string;
  right?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--card)",
        border: selected ? "2px solid var(--green-600)" : "1px solid var(--line)",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 99,
            border: selected ? "2px solid var(--green-600)" : "2px solid var(--line)",
            background: selected ? "var(--green-600)" : "var(--card)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected && (
            <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--card)" }} />
          )}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{sub}</div>
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink-2)" }}>{right}</div>
    </button>
  );
}

function PayOption({
  icon,
  title,
  sub,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderRadius: 12,
        background: "var(--card)",
        border: selected ? "2px solid var(--green-600)" : "1px solid var(--line)",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        boxShadow: selected ? "0 0 0 4px var(--pill-success-bg)" : "none",
        transition: "all .15s",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 11,
          background: "var(--grad-soft)",
          color: "var(--blue-700)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{sub}</div>
      </div>
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 99,
          border: selected ? "2px solid var(--green-600)" : "2px solid var(--line)",
          background: selected ? "var(--green-600)" : "var(--card)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && (
          <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--card)" }} />
        )}
      </div>
    </button>
  );
}
