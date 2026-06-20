import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import { AdminGate } from "@/wcm/admin-access";
import { useEffect, useState, useMemo } from "react";
import type { Database } from "@/integrations/supabase/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { NOINDEX_FOLLOW_META, canonicalUrl } from "@/lib/seo";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export const Route = createFileRoute("/admin/")({
  component: AdminHomePage,
  head: () => ({
    links: [{ rel: "canonical", href: canonicalUrl("/admin") }],
    meta: [{ title: "Admin Dashboard — Wellcare Mart" }, NOINDEX_FOLLOW_META],
  }),
});

const PKR = (n: number) => "Rs " + n.toLocaleString("en-PK");

interface DashboardMetrics {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  deliveredOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  lowStockProducts: number;
}

const STATUS_COLORS: Record<string, string> = {
  "Order placed": "#3b82f6",
  "Order confirmed": "#06b6d4",
  Processing: "#f59e0b",
  "Out for delivery": "#8b5cf6",
  Delivered: "#10b981",
  Cancelled: "#f43f5e",
};

const STATUS_LABEL_COLORS: Record<string, string> = {
  "Order placed": "#1d4ed8",
  "Order confirmed": "#0e7490",
  Processing: "#b45309",
  "Out for delivery": "#6d28d9",
  Delivered: "#059669",
  Cancelled: "#be123c",
};

function AdminHomePage() {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    deliveredOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    lowStockProducts: 0,
  });
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orderStatuses, setOrderStatuses] = useState<{ status: string }[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        const supabase = await getSupabase();

        const [
          { data: productsData, count: productCount },
          { count: activeCount },
          { data: ordersData, count: orderCount },
          { count: deliveredCount },
          { data: statusData },
        ] = await Promise.all([
          supabase.from("products").select("*", { count: "exact" }),
          supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
          supabase.from("orders").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(8),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "Delivered"),
          supabase.from("orders").select("status"),
        ]);

        if (cancelled) return;

        const allProducts = (productsData as ProductRow[]) || [];
        const allOrders = (ordersData as OrderRow[]) || [];

        const totalRevenue = allProducts.reduce(
          (sum, p) => sum + ((p as any).sales_count || 0) * p.price, 0,
        );
        const pendingOrderCount = allOrders.filter(
          (o) => !["Delivered", "Cancelled"].includes(o.status),
        ).length;
        const lowStockCount = allProducts.filter(
          (p) => p.stock?.trim().toLowerCase() === "low stock",
        ).length;
        const avgOrderValue = (orderCount || 0) > 0
          ? allOrders.reduce((s, o) => s + (o.total || 0), 0) / allOrders.length
          : 0;

        setMetrics({
          totalProducts: productCount || 0,
          activeProducts: activeCount || 0,
          totalOrders: orderCount || 0,
          deliveredOrders: deliveredCount || 0,
          pendingOrders: pendingOrderCount,
          totalRevenue,
          averageOrderValue: Math.round(avgOrderValue),
          lowStockProducts: lowStockCount,
        });

        setRecentOrders(allOrders);
        setProducts(allProducts);
        setOrderStatuses(statusData || []);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    };

    loadDashboard();
    return () => { cancelled = true; };
  }, []);

  // Order status donut data
  const orderStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    orderStatuses.forEach(({ status }) => {
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [orderStatuses]);

  // Category bar chart data
  const categoryData = useMemo(() => {
    const map: Record<string, { revenue: number; count: number }> = {};
    products.forEach((p) => {
      if (!map[p.cat]) map[p.cat] = { revenue: 0, count: 0 };
      map[p.cat].revenue += ((p as any).sales_count || 0) * p.price;
      map[p.cat].count += 1;
    });
    return Object.entries(map)
      .map(([name, d]) => ({
        name: name.length > 12 ? name.slice(0, 11) + "…" : name,
        fullName: name,
        revenue: Math.round(d.revenue / 1000),
        products: d.count,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 7);
  }, [products]);

  const deliveryRate = metrics.totalOrders > 0
    ? Math.round((metrics.deliveredOrders / metrics.totalOrders) * 100)
    : 0;

  return (
    <AdminGate>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: isMobile ? "0" : "30px 20px 90px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 24 : 30, fontWeight: 900, letterSpacing: -0.5, color: "var(--ink)" }}>
            Dashboard
          </h1>
          <p style={{ margin: "5px 0 0", color: "var(--ink-4)", fontSize: 13 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* ── Quick nav ── */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { to: "/admin/products", label: "Manage Products", icon: "📦", color: "#3b82f6", bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.2)" },
            { to: "/admin/orders",   label: "Manage Orders",   icon: "🎯", color: "#10b981", bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.2)" },
            { to: "/admin/sales",    label: "Sales Analytics", icon: "📊", color: "#8b5cf6", bg: "rgba(139,92,246,0.06)", border: "rgba(139,92,246,0.2)" },
          ].map(({ to, label, icon, color, bg, border }) => (
            <Link
              key={to}
              to={to}
              style={{ textDecoration: "none", background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(0.96)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{label}</span>
              </div>
              <span style={{ fontSize: 14, color, fontWeight: 700 }}>→</span>
            </Link>
          ))}
        </div>

        {/* ── Hero revenue card ── */}
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ height: 4, background: "linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6)" }} />
          <div style={{ padding: isMobile ? "20px 18px" : "28px 32px" }}>
            <div style={{ marginBottom: isMobile ? 18 : 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
                Total Revenue
              </div>
              <div style={{ fontSize: isMobile ? 34 : 48, fontWeight: 900, letterSpacing: -1.5, color: "var(--ink)", lineHeight: 1 }}>
                {loading ? "…" : PKR(metrics.totalRevenue)}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 8 }}>
                from {metrics.totalProducts} products · {deliveryRate}% delivery rate
              </div>
            </div>
            <div style={{ height: 1, background: "var(--line)", marginBottom: isMobile ? 14 : 20 }} />
            {isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Total Orders", value: loading ? "…" : String(metrics.totalOrders), color: "#3b82f6" },
                  { label: "Delivered", value: loading ? "…" : String(metrics.deliveredOrders), color: "#10b981" },
                  { label: "Pending", value: loading ? "…" : String(metrics.pendingOrders), color: "#f59e0b" },
                  { label: "Avg Order", value: loading ? "…" : PKR(metrics.averageOrderValue), color: "#8b5cf6" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-4)" }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color, letterSpacing: -0.3 }}>{value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
                {[
                  { label: "Total Orders", value: String(metrics.totalOrders), color: "#3b82f6" },
                  { label: "Delivered", value: String(metrics.deliveredOrders), color: "#10b981" },
                  { label: "Pending", value: String(metrics.pendingOrders), color: "#f59e0b" },
                  { label: "Avg Order Value", value: PKR(metrics.averageOrderValue), color: "#8b5cf6" },
                ].map(({ label, value, color }, i) => (
                  <div key={label} style={{ paddingLeft: i > 0 ? 24 : 0, borderLeft: i > 0 ? "1px solid var(--line)" : "none", paddingRight: i < 3 ? 24 : 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: -0.4 }}>{loading ? "…" : value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Alert chips ── */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {/* Low stock */}
          <div style={{ background: metrics.lowStockProducts > 0 ? "rgba(239,68,68,0.06)" : "var(--card)", border: `1px solid ${metrics.lowStockProducts > 0 ? "rgba(239,68,68,0.25)" : "var(--line)"}`, borderTop: `3px solid ${metrics.lowStockProducts > 0 ? "#ef4444" : "var(--line)"}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>⚠️ Low Stock</div>
              <div style={{ fontSize: 11, color: "var(--ink-4)" }}>items need restocking</div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: metrics.lowStockProducts > 0 ? "#dc2626" : "var(--ink)", letterSpacing: -0.5, flexShrink: 0 }}>{loading ? "…" : metrics.lowStockProducts}</div>
          </div>
          {/* Active products */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderTop: "3px solid #10b981", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>✅ Active Products</div>
              <div style={{ fontSize: 11, color: "var(--ink-4)" }}>of {metrics.totalProducts} total</div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#059669", letterSpacing: -0.5, flexShrink: 0 }}>{loading ? "…" : metrics.activeProducts}</div>
          </div>
          {/* Delivery rate */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderTop: "3px solid #6366f1", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>📦 Delivery Rate</div>
              <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{metrics.deliveredOrders} of {metrics.totalOrders} orders</div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#4f46e5", letterSpacing: -0.5, flexShrink: 0 }}>{loading ? "…" : `${deliveryRate}%`}</div>
          </div>
        </div>

        {/* ── Charts row ── */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1.6fr", gap: 16, marginBottom: 20 }}>

          {/* Order status donut */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: isMobile ? "16px 14px" : "20px 24px" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", marginBottom: 2 }}>Order Status</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)", marginBottom: 16 }}>Distribution across all orders</div>
            {loading || orderStatusData.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--ink-4)", padding: "30px 0", fontSize: 13 }}>No data yet</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={orderStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {orderStatusData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                            <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{d.name}</div>
                            <div style={{ color: STATUS_COLORS[d.name] ?? "var(--ink-4)", fontWeight: 800 }}>{d.value} orders</div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {orderStatusData.map((entry) => (
                    <div key={entry.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 9, height: 9, borderRadius: "50%", background: STATUS_COLORS[entry.name] ?? "#94a3b8", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>{entry.name}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: STATUS_LABEL_COLORS[entry.name] ?? "var(--ink-4)" }}>{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Category bar chart */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: isMobile ? "16px 14px" : "20px 24px" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", marginBottom: 2 }}>Revenue by Category</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)", marginBottom: 16 }}>Sales revenue in Rs. thousands</div>
            {loading || categoryData.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--ink-4)", padding: "30px 0", fontSize: 13 }}>No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--ink-4)" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={isMobile ? 80 : 100} tick={{ fontSize: isMobile ? 10 : 11, fill: "var(--ink-3)", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                          <div style={{ fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>{d.fullName}</div>
                          <div style={{ color: "#6366f1" }}>Revenue: <strong>Rs. {(d.revenue * 1000).toLocaleString()}</strong></div>
                          <div style={{ color: "var(--ink-4)" }}>Products: <strong>{d.products}</strong></div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="revenue" name="Revenue (Rs k)" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Recent Orders ── */}
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "14px 14px 12px" : "18px 20px 14px", borderBottom: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>Recent Orders</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>Last 8 orders</div>
            </div>
            <Link to="/admin/orders" style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", textDecoration: "none", padding: "6px 12px", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 8, background: "rgba(99,102,241,0.06)" }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div style={{ color: "var(--ink-4)", textAlign: "center", padding: "24px 0", fontSize: 13 }}>Loading…</div>
          ) : recentOrders.length === 0 ? (
            <div style={{ color: "var(--ink-4)", textAlign: "center", padding: "24px 0", fontSize: 13 }}>No orders yet</div>
          ) : (
            recentOrders.map((order, i) => {
              const color = STATUS_COLORS[order.status] ?? "#94a3b8";
              const labelColor = STATUS_LABEL_COLORS[order.status] ?? "#475569";
              const bg = color + "14";
              return (
                <div
                  key={order.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: isMobile ? "11px 14px" : "13px 20px",
                    borderBottom: i < recentOrders.length - 1 ? "1px solid var(--line)" : "none",
                    borderLeft: `3px solid ${color}`,
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{order.order_code}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>
                      {new Date(order.created_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", flexShrink: 0 }}>{PKR(order.total || 0)}</div>
                  <div style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color: labelColor, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {order.status}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </AdminGate>
  );
}
