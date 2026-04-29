import { Suspense, lazy } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { PlacedOrderData } from "@/wcm/cart";
import { useWcm } from "@/wcm/context";
import { type Order } from "@/wcm/data";
import { Btn } from "@/wcm/ui";

const CheckoutContent = lazy(() =>
  import("@/wcm/cart").then((m) => ({ default: m.CheckoutContent })),
);

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({
    meta: [{ title: "Checkout — Wellcare Mart" }],
  }),
});

function CheckoutPage() {
  const { checkoutData, setCheckoutData, user, setAuthOpen, setCart, setOrders, push } = useWcm();
  const navigate = useNavigate();

  const placeOrder = async (data: PlacedOrderData) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setAuthOpen(true);
      return;
    }
    const id = "WCM-" + (2900 + Math.floor(Math.random() * 100));
    const today = new Date();
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    const eta = new Date(today);
    eta.setDate(today.getDate() + 1);
    const newOrder: Order = {
      id,
      placed: fmt(today),
      eta: fmt(eta),
      status: "Order placed",
      progress: 0,
      address: `${data.ship.address}, ${data.ship.city}`,
      payment: data.pay,
      items: data.items.map((it: any) => ({ id: it.p.id, qty: it.qty })),
      subtotal: data.subtotal,
      shipping: data.shipping,
      total: data.total,
    };
    const { error } = await supabase.from("orders").insert({
      user_id: session.user.id,
      order_code: id,
      placed: newOrder.placed,
      eta: newOrder.eta,
      status: newOrder.status,
      progress: 0,
      address: newOrder.address,
      payment: newOrder.payment,
      items: newOrder.items as any,
      subtotal: newOrder.subtotal,
      shipping: newOrder.shipping,
      total: newOrder.total,
    });
    if (error) {
      push("Could not place order: " + error.message);
      return;
    }
    setOrders((o) => [newOrder, ...o]);
    setCart([]);
    setCheckoutData(null);
    navigate({ to: "/orders/$orderId", params: { orderId: newOrder.id } });
  };

  if (!checkoutData) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Your cart is empty</div>
        <div style={{ color: "var(--ink-4)", fontSize: 14, marginBottom: 20 }}>
          Add items to your cart before checking out.
        </div>
        <Btn onClick={() => navigate({ to: "/" })}>Browse products</Btn>
      </div>
    );
  }

  return (
    <Suspense
      fallback={<div style={{ padding: 20, color: "var(--ink-4)" }}>Loading checkout…</div>}
    >
      <CheckoutContent
        {...checkoutData}
        user={user}
        onClose={() => navigate({ to: "/" })}
        onPlace={placeOrder}
      />
    </Suspense>
  );
}
