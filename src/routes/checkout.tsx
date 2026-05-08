import { Suspense, lazy, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getSupabase } from "@/integrations/supabase/client";
import type { PlacedOrderData } from "@/wcm/cart";
import { useWcm } from "@/wcm/context";
import { type Order } from "@/wcm/data";
import { WellcareLoader } from "@/wcm/loader";
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

  const [placing, setPlacing] = useState(false);

  const placeOrder = async (data: PlacedOrderData) => {
    setPlacing(true);
    const supabase = await getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setAuthOpen(true);
      setPlacing(false);
      return;
    }

    // Prices are NOT trusted from the client — the edge function re-fetches
    // product prices from the DB and recomputes subtotal/shipping/total.
    const body = {
      items: data.items.map((it: { p: { id: string }; qty: number }) => ({
        id: it.p.id,
        qty: it.qty,
      })),
      ship: data.ship,
      pay: data.pay,
      // Pass promo code so the edge function can validate and apply it server-side.
      // The discount amount from the client is ignored; the server recomputes it.
      promo_code: data.promo_code,
    };

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/place-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      push(json?.error ?? "Could not place order. Please try again.");
      setPlacing(false);
      return;
    }

    const newOrder: Order = json.order;
    setOrders((o) => [newOrder, ...o]);
    setCart([]);
    setCheckoutData(null);
    navigate({ to: "/orders/$orderId", params: { orderId: newOrder.id } });
    setPlacing(false);
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
    <Suspense fallback={<WellcareLoader label="Loading checkout" compact />}>
      <CheckoutContent
        {...checkoutData}
        user={user}
        placing={placing}
        onClose={() => navigate({ to: "/" })}
        onPlace={placeOrder}
      />
    </Suspense>
  );
}
