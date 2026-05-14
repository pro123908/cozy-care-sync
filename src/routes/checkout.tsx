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
  const {
    checkoutData,
    setCheckoutData,
    user,
    setAuthOpen,
    setCart,
    setOrders,
    push,
    cart,
    products,
  } = useWcm();
  const navigate = useNavigate();

  const [placing, setPlacing] = useState(false);

  const fallbackItems = cart
    .map((line) => ({ ...line, p: products.find((product) => product.id === line.id) }))
    .filter((item): item is { id: string; qty: number; p: (typeof products)[number] } =>
      Boolean(item.p),
    );
  const fallbackSubtotal = fallbackItems.reduce((sum, item) => sum + item.p.price * item.qty, 0);
  const fallbackShipping = fallbackSubtotal === 0 ? 0 : fallbackSubtotal >= 2000 ? 0 : 250;
  const fallbackTotal = fallbackSubtotal + fallbackShipping;

  const resolvedCheckoutData =
    checkoutData ??
    (fallbackItems.length > 0
      ? {
          items: fallbackItems,
          subtotal: fallbackSubtotal,
          shipping: fallbackShipping,
          total: fallbackTotal,
        }
      : null);

  const placeOrder = async (data: PlacedOrderData) => {
    setPlacing(true);
    try {
      const supabase = await getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        push("Please sign in to continue checkout.", { tone: "orange" });
        setAuthOpen(true);
        return;
      }

      // Prices are NOT trusted from the client — the edge function re-fetches
      // product prices from the DB and recomputes subtotal/shipping/total.
      const body = {
        items: data.items.map((it: { p: { id: string }; qty: number; size?: string }) => ({
          id: it.p.id,
          qty: it.qty,
          ...(it.size ? { size: it.size } : {}),
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

      let payload: any = null;
      const responseType = res.headers.get("content-type") || "";
      if (responseType.includes("application/json")) {
        payload = await res.json().catch(() => null);
      } else {
        const text = await res.text().catch(() => "");
        payload = text ? { error: text } : null;
      }

      if (!res.ok) {
        push(payload?.error ?? `Could not place order (${res.status}). Please try again.`);
        return;
      }

      if (!payload?.order?.id) {
        push("Order was created, but the response was invalid. Please check Orders.");
        navigate({ to: "/orders" });
        return;
      }

      const newOrder: Order = payload.order;
      setOrders((o) => [newOrder, ...o]);
      setCart([]);
      setCheckoutData(null);
      navigate({ to: "/orders/$orderId", params: { orderId: newOrder.id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      push(`Could not place order. ${message}`);
    } finally {
      setPlacing(false);
    }
  };

  if (!resolvedCheckoutData) {
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
        {...resolvedCheckoutData}
        user={user}
        placing={placing}
        onClose={() => navigate({ to: "/" })}
        onPlace={placeOrder}
      />
    </Suspense>
  );
}
