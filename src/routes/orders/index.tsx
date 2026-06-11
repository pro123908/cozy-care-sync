import { Suspense, lazy, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useWcm } from "@/wcm/context";
import { WellcareLoader } from "@/wcm/loader";
import { Btn } from "@/wcm/ui";
import { Icons } from "@/wcm/icons";
import type { Order } from "@/wcm/data";

const OrdersList = lazy(() => import("@/wcm/orders").then((m) => ({ default: m.OrdersList })));
const OrderDetail = lazy(() => import("@/wcm/orders").then((m) => ({ default: m.OrderDetail })));

export const Route = createFileRoute("/orders/")({
  component: OrdersPage,
  head: () => ({
    meta: [{ title: "My Orders — Wellcare Mart" }],
  }),
});

function OrdersPage() {
  const { orders, ordersLoaded, user, setAuthOpen, push } = useWcm();
  const navigate = useNavigate();
  const [guestOrders, setGuestOrders] = useState<Order[]>([]);
  const [activeGuestOrder, setActiveGuestOrder] = useState<Order | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestLoaded, setGuestLoaded] = useState(false);

  useEffect(() => {
    if (user) return;

    const cachedOrdersRaw = localStorage.getItem("wcm-guest-orders");
    if (cachedOrdersRaw) {
      try {
        const cachedOrders = JSON.parse(cachedOrdersRaw) as Order[];
        if (Array.isArray(cachedOrders) && cachedOrders.length > 0) {
          setGuestOrders(cachedOrders);
          setGuestLoaded(true);
          return;
        }
      } catch {
        // Fall back to the legacy single-order lookup below.
      }
    }

    const raw = localStorage.getItem("wcm-guest-order");
    if (!raw) {
      setGuestLoaded(true);
      return;
    }

    let parsed: { orderId?: string; phone?: string } | null = null;
    try {
      parsed = JSON.parse(raw) as { orderId?: string; phone?: string };
    } catch {
      setGuestLoaded(true);
      return;
    }

    const orderId = parsed?.orderId?.trim();
    const phone = parsed?.phone?.trim();
    if (!orderId || !phone) {
      setGuestLoaded(true);
      return;
    }

    let cancelled = false;
    const loadGuestOrder = async () => {
      setGuestLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-order-lookup`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: orderId, phone }),
          },
        );
        const payload = await res.json().catch(() => null);
        if (!cancelled && res.ok && payload?.order) {
          const order = payload.order as Order;
          setGuestOrders([order]);
          setActiveGuestOrder(order);
          return;
        }
        if (!cancelled) {
          push(payload?.error || "Could not load guest order.", { tone: "orange" });
        }
      } catch {
        if (!cancelled) push("Could not load guest order.", { tone: "orange" });
      } finally {
        if (!cancelled) {
          setGuestLoading(false);
          setGuestLoaded(true);
        }
      }
    };

    void loadGuestOrder();

    return () => {
      cancelled = true;
    };
  }, [push, user]);

  if (!user && guestLoading) {
    return <WellcareLoader label="Loading guest order" compact />;
  }

  if (!user && guestOrders.length > 0) {
    return (
      <Suspense fallback={<WellcareLoader label="Loading order" compact />}>
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-4)" }}>
                Guest orders
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>
                Your placed orders
              </div>
            </div>
            <Btn
              variant="outline"
              onClick={() => navigate({ to: "/track-order" })}
              icon={Icons.search}
            >
              Track another order
            </Btn>
          </div>

          <OrdersList
            orders={guestOrders}
            ordersLoaded={true}
            openOrder={(o) => setActiveGuestOrder(o)}
            goShop={() => navigate({ to: "/" })}
          />

          {activeGuestOrder && (
            <OrderDetail order={activeGuestOrder} onClose={() => setActiveGuestOrder(null)} />
          )}
        </div>
      </Suspense>
    );
  }

  if (!user && guestLoaded && guestOrders.length === 0) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: "var(--grad-soft)",
            color: "var(--blue-700)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          {Icons.pkg}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
          Sign in to see your orders
        </div>
        <div style={{ color: "var(--ink-4)", fontSize: 14, marginBottom: 20 }}>
          Your order history will appear here once you're signed in.
        </div>
        <div
          style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}
        >
          <Btn onClick={() => setAuthOpen(true)} icon={Icons.user}>
            Sign in
          </Btn>
          <Btn
            variant="outline"
            onClick={() => navigate({ to: "/track-order" })}
            icon={Icons.search}
          >
            Track guest order
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<WellcareLoader label="Loading orders" compact />}>
      <OrdersList
        orders={orders}
        ordersLoaded={ordersLoaded}
        openOrder={(o) => navigate({ to: "/orders/$orderId", params: { orderId: o.id } })}
        goShop={() => navigate({ to: "/" })}
      />
    </Suspense>
  );
}
