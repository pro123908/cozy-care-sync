import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { OrderDetail } from "@/wcm/orders";
import { useWcm } from "@/wcm/context";
import { Btn } from "@/wcm/ui";

export const Route = createFileRoute("/orders/$orderId")({
  component: OrderDetailPage,
  head: ({ params }: { params: { orderId: string } }) => ({
    meta: [{ title: `Order ${params.orderId} — Wellcare Mart` }],
  }),
});

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const { orders, ordersLoaded, user, setAuthOpen, setOrders, push } = useWcm();
  const navigate = useNavigate();

  const onCancel = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: "Cancelled", progress: 0 })
      .eq("order_code", orderId)
      .eq("user_id", session.user.id);
    if (!error) {
      setOrders((os) =>
        os.map((o) => (o.id === orderId ? { ...o, status: "Cancelled", progress: 0 } : o)),
      );
      push("Order cancelled");
      navigate({ to: "/orders" });
    }
  };

  if (!user) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
          Sign in to view this order
        </div>
        <Btn onClick={() => setAuthOpen(true)}>Sign in</Btn>
      </div>
    );
  }

  if (!ordersLoaded) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center", color: "var(--ink-4)" }}>
        Loading order…
      </div>
    );
  }

  const order = orders.find((o) => o.id === orderId);

  if (!order) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Order not found</div>
        <div style={{ color: "var(--ink-4)", fontSize: 14, marginBottom: 20 }}>
          This order doesn't exist or belongs to another account.
        </div>
        <Btn onClick={() => navigate({ to: "/orders" })}>Back to orders</Btn>
      </div>
    );
  }

  return (
    <OrderDetail order={order} onClose={() => navigate({ to: "/orders" })} onCancel={onCancel} />
  );
}
