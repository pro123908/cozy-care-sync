import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import { AdminGate } from "@/wcm/admin-access";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/")({
  component: AdminHomePage,
  head: () => ({
    meta: [{ title: "Admin Dashboard — Wellcare Mart" }],
  }),
});

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div style={{ color: "var(--ink-4)", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color: "var(--ink)", fontSize: 26, fontWeight: 800, letterSpacing: -0.4 }}>
        {value}
      </div>
    </div>
  );
}

function AdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ products: 0, activeProducts: 0, orders: 0 });

  useEffect(() => {
    let cancelled = false;

    const loadMetrics = async () => {
      const supabase = await getSupabase();
      const [productsRes, activeProductsRes, ordersRes] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("orders").select("id", { count: "exact", head: true }),
      ]);

      if (cancelled) return;

      setMetrics({
        products: productsRes.count || 0,
        activeProducts: activeProductsRes.count || 0,
        orders: ordersRes.count || 0,
      });
      setLoading(false);
    };

    void loadMetrics();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminGate>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "30px 20px 90px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: 30,
            lineHeight: 1.1,
            letterSpacing: -0.4,
            color: "var(--ink)",
          }}
        >
          Admin Dashboard
        </h1>
        <p style={{ marginTop: 8, marginBottom: 22, color: "var(--ink-4)", fontSize: 14 }}>
          Manage catalog and orders from one place.
        </p>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          }}
        >
          <MetricCard label="Total products" value={loading ? "…" : metrics.products} />
          <MetricCard label="Active products" value={loading ? "…" : metrics.activeProducts} />
          <MetricCard label="Total orders" value={loading ? "…" : metrics.orders} />
        </div>

        <div
          style={{
            marginTop: 22,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          }}
        >
          <Link to="/admin/products" style={actionCardStyle}>
            <div style={cardTitleStyle}>Manage products</div>
            <div style={cardDescStyle}>Create, update, and archive catalog items.</div>
          </Link>
          <Link to="/admin/orders" style={actionCardStyle}>
            <div style={cardTitleStyle}>Manage orders</div>
            <div style={cardDescStyle}>Track and update order status and progress.</div>
          </Link>
        </div>
      </div>
    </AdminGate>
  );
}

const actionCardStyle: CSSProperties = {
  textDecoration: "none",
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: 18,
  display: "block",
};

const cardTitleStyle: CSSProperties = {
  color: "var(--ink)",
  fontWeight: 800,
  fontSize: 16,
};

const cardDescStyle: CSSProperties = {
  color: "var(--ink-4)",
  fontSize: 13,
  marginTop: 5,
};
