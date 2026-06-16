import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getSupabase } from "@/integrations/supabase/client";
import type { PlacedOrderData } from "@/wcm/cart";
import { useWcm } from "@/wcm/context";
import { getUnitPrice, type Order } from "@/wcm/data";
import { WellcareLoader } from "@/wcm/loader";
import { Btn } from "@/wcm/ui";
import { NOINDEX_FOLLOW_META, canonicalUrl } from "@/lib/seo";
import { trackMetaEvent, toMetaValue, uniqueContentIds } from "@/lib/meta-pixel";

const CheckoutContent = lazy(() =>
  import("@/wcm/cart").then((m) => ({ default: m.CheckoutContent })),
);

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({
    links: [{ rel: "canonical", href: canonicalUrl("/checkout") }],
    meta: [{ title: "Checkout — Wellcare Mart" }, NOINDEX_FOLLOW_META],
  }),
});

function CheckoutPage() {
  const { checkoutData, setCheckoutData, user, setCart, setOrders, push, cart, products } =
    useWcm();
  const navigate = useNavigate();

  const [placing, setPlacing] = useState(false);
  const checkoutTrackedRef = useRef(false);

  const fallbackItems = cart
    .map((line) => ({ ...line, p: products.find((product) => product.id === line.id) }))
    .filter(
      (item): item is { id: string; qty: number; size?: string; p: (typeof products)[number] } =>
        Boolean(item.p),
    );
  const fallbackSubtotal = fallbackItems.reduce(
    (sum, item) => sum + getUnitPrice(item.p, item.size) * item.qty,
    0,
  );
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

  useEffect(() => {
    if (!resolvedCheckoutData || checkoutTrackedRef.current) return;

    const itemIds = uniqueContentIds(
      resolvedCheckoutData.items.map(
        (item: { p?: { id?: string }; id?: string }) => item.p?.id || item.id,
      ),
    );
    const numItems = resolvedCheckoutData.items.reduce(
      (sum: number, item: { qty?: number }) => sum + Math.max(1, Number(item.qty) || 1),
      0,
    );

    trackMetaEvent(
      "InitiateCheckout",
      {
        content_ids: itemIds,
        content_type: "product",
        num_items: numItems,
        contents: resolvedCheckoutData.items.map(
          (item: {
            p?: { id?: string; price?: number };
            id?: string;
            qty?: number;
            unit_price?: number;
          }) => {
            const id = item.p?.id || item.id || "";
            const quantity = Math.max(1, Number(item.qty) || 1);
            const itemPrice = toMetaValue(Number(item.unit_price ?? item.p?.price ?? 0));
            return { id, quantity, item_price: itemPrice };
          },
        ),
        value: toMetaValue(resolvedCheckoutData.total),
        currency: "PKR",
      },
      {
        userData: { email: user?.email },
      },
    );
    checkoutTrackedRef.current = true;
  }, [resolvedCheckoutData, user?.email]);

  const placeOrder = async (data: PlacedOrderData) => {
    setPlacing(true);
    try {
      const supabase = await getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();

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

      const cartContentIds = uniqueContentIds(data.items.map((item) => item?.p?.id));
      const numItems = data.items.reduce(
        (sum, item) => sum + Math.max(1, Number(item.qty) || 1),
        0,
      );

      trackMetaEvent(
        "AddPaymentInfo",
        {
          content_ids: cartContentIds,
          content_type: "product",
          num_items: numItems,
          contents: data.items.map((item) => ({
            id: item.p.id,
            quantity: Math.max(1, Number(item.qty) || 1),
            item_price: toMetaValue(getUnitPrice(item.p, item.size)),
          })),
          value: toMetaValue(data.total),
          currency: "PKR",
        },
        {
          userData: { email: data.ship.email || user?.email, phone: data.ship.phone },
        },
      );

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (user && session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/place-order`, {
        method: "POST",
        headers,
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

      setCart([]);
      setCheckoutData(null);

      if (session?.user) {
        setOrders((o) => [newOrder, ...o]);
        navigate({ to: "/orders/$orderId", params: { orderId: newOrder.id } });
      } else {
        try {
          const raw = localStorage.getItem("wcm-guest-orders");
          const existing = raw ? (JSON.parse(raw) as Order[]) : [];
          const nextOrders = [newOrder, ...existing.filter((order) => order.id !== newOrder.id)];
          localStorage.setItem("wcm-guest-orders", JSON.stringify(nextOrders));
          localStorage.setItem(
            "wcm-guest-order",
            JSON.stringify({ orderId: newOrder.id, phone: data.ship.phone }),
          );
        } catch {}
        push(`Order placed successfully. Your order ID is ${newOrder.id}.`, { tone: "green" });
        navigate({ to: "/orders" });
      }
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
