import { Suspense, lazy, useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import type { Order } from "@/wcm/data";
import { WellcareLoader } from "@/wcm/loader";
import { Btn } from "@/wcm/ui";

const OrderDetail = lazy(() => import("@/wcm/orders").then((m) => ({ default: m.OrderDetail })));

export const Route = createFileRoute("/track-order")({
  validateSearch: (search: Record<string, unknown>) => ({
    orderId: typeof search.orderId === "string" ? search.orderId : "",
    phone: typeof search.phone === "string" ? search.phone : "",
  }),
  component: TrackOrderPage,
  head: () => ({
    meta: [{ title: "Track Order — Wellcare Mart" }],
  }),
});

function TrackOrderPage() {
  const navigate = useNavigate();
  const { orderId: initialOrderId, phone: initialPhone } = useSearch({ from: "/track-order" });

  const [orderId, setOrderId] = useState(initialOrderId || "");
  const [phone, setPhone] = useState(initialPhone || "");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lookupOrder = async (nextOrderId: string, nextPhone: string) => {
    const cleanOrderId = nextOrderId.trim().toUpperCase();
    const cleanPhone = nextPhone.trim();
    if (!cleanOrderId || !cleanPhone) {
      setError("Please enter both order ID and phone number.");
      return;
    }

    setLoading(true);
    setError("");
    setOrder(null);

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-order-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: cleanOrderId,
          phone: cleanPhone,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.order) {
        setError(payload?.error || "Order not found. Check order ID and phone number.");
        return;
      }

      setOrder(payload.order as Order);
      navigate({
        to: "/track-order",
        search: {
          orderId: cleanOrderId,
          phone: cleanPhone,
        },
        replace: true,
      });
    } catch {
      setError("Could not fetch order right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialOrderId || !initialPhone) return;
    void lookupOrder(initialOrderId, initialPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "30px 20px 90px" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.4 }}>Track your order</h1>
        <p style={{ margin: "6px 0 0", color: "var(--ink-4)", fontSize: 14 }}>
          Enter the order ID and phone used at checkout.
        </p>
      </div>

      {!order && (
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-4)" }}>Order ID</span>
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="WCM-XXXXXX"
              autoCapitalize="characters"
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-4)" }}>Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03xx xxxxxxx"
              style={inputStyle}
            />
          </label>

          {error ? <div style={{ color: "var(--pill-rose-fg)", fontSize: 13 }}>{error}</div> : null}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn onClick={() => void lookupOrder(orderId, phone)} disabled={loading}>
              {loading ? "Checking..." : "Track order"}
            </Btn>
            <Btn variant="outline" onClick={() => navigate({ to: "/" })}>
              Back to shop
            </Btn>
          </div>
        </div>
      )}

      {order && (
        <Suspense fallback={<WellcareLoader label="Loading order detail" compact />}>
          <OrderDetail
            order={order}
            onClose={() => {
              setOrder(null);
              setError("");
              navigate({ to: "/track-order", search: { orderId: "", phone: "" }, replace: true });
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  fontSize: 14,
  background: "var(--bg-elev)",
  color: "var(--ink)",
  fontFamily: "inherit",
};
