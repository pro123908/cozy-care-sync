import { Suspense, lazy } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getSupabase } from "@/integrations/supabase/client";
import { useWcm } from "@/wcm/context";
import { WellcareLoader } from "@/wcm/loader";
import { Btn } from "@/wcm/ui";
import { NOINDEX_FOLLOW_META, canonicalUrl } from "@/lib/seo";

const OrderDetail = lazy(() => import("@/wcm/orders").then((m) => ({ default: m.OrderDetail })));

export const Route = createFileRoute("/orders/$orderId")({
  component: OrderDetailPage,
  head: ({ params }: { params: { orderId: string } }) => ({
    links: [{ rel: "canonical", href: canonicalUrl(`/orders/${params.orderId}`) }],
    meta: [{ title: `Order ${params.orderId} — Wellcare Mart` }, NOINDEX_FOLLOW_META],
  }),
});

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const { orders, ordersLoaded, user, setAuthOpen, setOrders, push } = useWcm();
  const navigate = useNavigate();

  const onCancel = async () => {
    const supabase = await getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: "Cancelled", progress: 0 })
      .eq("order_code", orderId)
      .eq("user_id", session.user.id);
    if (error) {
      push("Failed to cancel order. Please try again.");
      return;
    }
    setOrders((os) =>
      os.map((o) => (o.id === orderId ? { ...o, status: "Cancelled", progress: 0 } : o)),
    );
    push("Order cancelled");
    navigate({ to: "/orders" });
  };

  if (!user) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
          Sign in to view this order
        </div>
        <div
          style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}
        >
          <Btn onClick={() => setAuthOpen(true)}>Sign in</Btn>
          <Btn variant="outline" onClick={() => navigate({ to: "/track-order" })}>
            Track guest order
          </Btn>
        </div>
      </div>
    );
  }

  if (!ordersLoaded) {
    return <WellcareLoader label="Loading order" compact />;
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
    <Suspense fallback={<WellcareLoader label="Loading order detail" compact />}>
      <OrderDetail order={order} onClose={() => navigate({ to: "/orders" })} onCancel={onCancel} />
    </Suspense>
  );
}
