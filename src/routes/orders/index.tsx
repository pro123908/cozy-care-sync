import { Suspense, lazy } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useWcm } from "@/wcm/context";
import { Btn } from "@/wcm/ui";
import { Icons } from "@/wcm/icons";

const OrdersList = lazy(() => import("@/wcm/orders").then((m) => ({ default: m.OrdersList })));

export const Route = createFileRoute("/orders/")({
  component: OrdersPage,
  head: () => ({
    meta: [{ title: "My Orders — Wellcare Mart" }],
  }),
});

function OrdersPage() {
  const { orders, ordersLoaded, user, setAuthOpen } = useWcm();
  const navigate = useNavigate();

  if (!user) {
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
        <Btn onClick={() => setAuthOpen(true)} icon={Icons.user}>
          Sign in
        </Btn>
      </div>
    );
  }

  return (
    <Suspense fallback={<div style={{ padding: 20, color: "var(--ink-4)" }}>Loading orders…</div>}>
      <OrdersList
        orders={orders}
        ordersLoaded={ordersLoaded}
        openOrder={(o) => navigate({ to: "/orders/$orderId", params: { orderId: o.id } })}
        goShop={() => navigate({ to: "/" })}
      />
    </Suspense>
  );
}
