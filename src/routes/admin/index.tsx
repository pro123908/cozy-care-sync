import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import { AdminGate } from "@/wcm/admin-access";
import { useEffect, useState, useMemo } from "react";
import type { Database } from "@/integrations/supabase/types";
import { NOINDEX_FOLLOW_META, canonicalUrl } from "@/lib/seo";

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
  inactiveProducts: number;
  totalOrders: number;
  deliveredOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  lowStockProducts: number;
}

function MetricCard({
  label,
  value,
  icon,
  trend,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  tone?: "default" | "green" | "blue" | "orange" | "rose";
}) {
  const toneColors = {
    default: { bg: "var(--card)", border: "var(--line)", text: "var(--ink)" },
    green: {
      bg: "rgba(16, 185, 129, 0.08)",
      border: "rgba(16, 185, 129, 0.2)",
      text: "var(--green-600)",
    },
    blue: {
      bg: "rgba(59, 130, 246, 0.08)",
      border: "rgba(59, 130, 246, 0.2)",
      text: "var(--blue-600)",
    },
    orange: {
      bg: "rgba(245, 158, 11, 0.08)",
      border: "rgba(245, 158, 11, 0.2)",
      text: "var(--pill-warn-bg)",
    },
    rose: {
      bg: "rgba(244, 63, 94, 0.08)",
      border: "rgba(244, 63, 94, 0.2)",
      text: "var(--pill-rose-fg)",
    },
  };

  const colors = toneColors[tone];

  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: 20,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        transition: "all .2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div>
        <div style={{ color: "var(--ink-4)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
          {label}
        </div>
        <div
          style={{
            color: "var(--ink)",
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: -0.4,
            marginBottom: 6,
          }}
        >
          {value}
        </div>
        {trend && (
          <div
            style={{ fontSize: 12, color: trend.value > 0 ? "var(--green-600)" : "var(--ink-4)" }}
          >
            {trend.value > 0 ? "↑" : trend.value < 0 ? "↓" : "→"} {Math.abs(trend.value)}%{" "}
            {trend.label}
          </div>
        )}
      </div>
      {icon && (
        <div
          style={{
            fontSize: 28,
            opacity: 0.3,
            lineHeight: 1,
          }}
        >
          {icon}
        </div>
      )}
    </div>
  );
}

function RecentOrderCard({ order }: { order: OrderRow }) {
  const statusColors: Record<string, string> = {
    "Order placed": "var(--pill-info-bg)",
    "Order confirmed": "var(--pill-info-bg)",
    Processing: "var(--pill-warn-bg)",
    "Out for delivery": "var(--pill-warn-bg)",
    Delivered: "var(--pill-success-bg)",
    Cancelled: "var(--pill-slate-bg)",
  };

  const statusFgColors: Record<string, string> = {
    "Order placed": "var(--pill-info-fg)",
    "Order confirmed": "var(--pill-info-fg)",
    Processing: "var(--pill-warn-fg)",
    "Out for delivery": "var(--pill-warn-fg)",
    Delivered: "var(--pill-success-fg)",
    Cancelled: "var(--pill-slate-fg)",
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>
            {order.order_code}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-4)" }}>
            {new Date(order.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
        {PKR(order.total || 0)}
      </div>
      <div
        style={{
          background: statusColors[order.status],
          color: statusFgColors[order.status],
          padding: "4px 10px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {order.status}
      </div>
    </div>
  );
}

function CategoryStats({ products }: { products: ProductRow[] }) {
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, { count: number; revenue: number }> = {};
    products.forEach((p) => {
      if (!breakdown[p.cat]) breakdown[p.cat] = { count: 0, revenue: 0 };
      breakdown[p.cat].count += 1;
      const salesCount = (p as any).sales_count || 0;
      breakdown[p.cat].revenue += salesCount * p.price;
    });
    return Object.entries(breakdown)
      .map(([cat, data]) => ({ cat, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [products]);

  const maxRevenue = Math.max(...categoryBreakdown.map((c) => c.revenue), 1);

  return (
    <div>
      {categoryBreakdown.map((cat) => (
        <div key={cat.cat} style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{cat.cat}</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
              {PKR(Math.round(cat.revenue))}
            </div>
          </div>
          <div
            style={{
              width: "100%",
              height: 6,
              background: "var(--line)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "var(--grad)",
                width: `${(cat.revenue / maxRevenue) * 100}%`,
                transition: "width .3s",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalProducts: 0,
    activeProducts: 0,
    inactiveProducts: 0,
    totalOrders: 0,
    deliveredOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    lowStockProducts: 0,
  });
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        const supabase = await getSupabase();

        // Load products
        const { data: productsData, count: productCount } = await supabase
          .from("products")
          .select("*", { count: "exact" });

        // Load active products
        const { count: activeCount } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("active", true);

        // Load orders
        const { data: ordersData, count: orderCount } = await supabase
          .from("orders")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .limit(8);

        // Load delivered orders
        const { count: deliveredCount } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "Delivered");

        if (cancelled) return;

        const allProducts = (productsData as ProductRow[]) || [];
        const allOrders = (ordersData as OrderRow[]) || [];

        const totalRevenue = allProducts.reduce(
          (sum, p) => sum + ((p as any).sales_count || 0) * p.price,
          0,
        );
        const avgOrderValue = allOrders.length > 0 ? totalRevenue / allOrders.length : 0;
        const lowStockCount = allProducts.filter(
          (p) => p.stock?.trim().toLowerCase() === "low stock",
        ).length;
        const pendingOrderCount = allOrders.filter(
          (o) => !["Delivered", "Cancelled"].includes(o.status),
        ).length;

        setMetrics({
          totalProducts: productCount || 0,
          activeProducts: activeCount || 0,
          inactiveProducts: (productCount || 0) - (activeCount || 0),
          totalOrders: orderCount || 0,
          deliveredOrders: deliveredCount || 0,
          pendingOrders: pendingOrderCount,
          totalRevenue,
          averageOrderValue: Math.round(avgOrderValue),
          lowStockProducts: lowStockCount,
        });

        setRecentOrders(allOrders);
        setProducts(allProducts);
        setLoading(false);
      } catch (error) {
        console.error("Error loading dashboard:", error);
        setLoading(false);
      }
    };

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminGate>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "30px 20px 90px" }}>
        {/* Header */}
        <div style={{ marginBottom: 30 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              lineHeight: 1.1,
              letterSpacing: -0.4,
              color: "var(--ink)",
              fontWeight: 900,
            }}
          >
            Dashboard
          </h1>
          <p style={{ marginTop: 8, color: "var(--ink-4)", fontSize: 14 }}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Key Metrics */}
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            marginBottom: 30,
          }}
        >
          <MetricCard
            label="Total Revenue"
            value={loading ? "…" : PKR(metrics.totalRevenue)}
            icon="💰"
            tone="green"
          />
          <MetricCard
            label="Total Orders"
            value={loading ? "…" : metrics.totalOrders}
            icon="📦"
            tone="blue"
          />
          <MetricCard
            label="Delivered Orders"
            value={loading ? "…" : metrics.deliveredOrders}
            icon="✓"
            tone="green"
            trend={
              metrics.totalOrders > 0
                ? {
                    value: Math.round((metrics.deliveredOrders / metrics.totalOrders) * 100),
                    label: "of total",
                  }
                : undefined
            }
          />
          <MetricCard
            label="Pending Orders"
            value={loading ? "…" : metrics.pendingOrders}
            icon="⏳"
            tone="orange"
          />
          <MetricCard
            label="Total Products"
            value={loading ? "…" : metrics.totalProducts}
            icon="🛍️"
            tone="blue"
          />
          <MetricCard
            label="Low Stock Items"
            value={loading ? "…" : metrics.lowStockProducts}
            icon="⚠️"
            tone={metrics.lowStockProducts > 0 ? "rose" : "default"}
          />
        </div>

        {/* Two Column Layout */}
        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "2fr 1fr",
            marginBottom: 20,
          }}
        >
          {/* Recent Orders */}
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  color: "var(--ink)",
                }}
              >
                Recent Orders
              </h2>
              <Link
                to="/admin/orders"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--blue-600)",
                  textDecoration: "none",
                }}
              >
                View all →
              </Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {loading ? (
                <div style={{ color: "var(--ink-4)", textAlign: "center", padding: "20px 0" }}>
                  Loading...
                </div>
              ) : recentOrders.length === 0 ? (
                <div style={{ color: "var(--ink-4)", textAlign: "center", padding: "20px 0" }}>
                  No orders yet
                </div>
              ) : (
                recentOrders.map((order) => <RecentOrderCard key={order.id} order={order} />)
              )}
            </div>
          </div>

          {/* Category Revenue Breakdown */}
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <h2
              style={{
                margin: "0 0 16px 0",
                fontSize: 16,
                fontWeight: 800,
                color: "var(--ink)",
              }}
            >
              Top Categories
            </h2>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {loading ? (
                <div style={{ color: "var(--ink-4)", textAlign: "center", padding: "20px 0" }}>
                  Loading...
                </div>
              ) : (
                <CategoryStats products={products} />
              )}
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          <Link to="/admin/products" style={actionCardStyle}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>📦</div>
            <div style={cardTitleStyle}>Manage Products</div>
            <div style={cardDescStyle}>Create, update, and manage your catalog.</div>
          </Link>
          <Link to="/admin/orders" style={actionCardStyle}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>🎯</div>
            <div style={cardTitleStyle}>Manage Orders</div>
            <div style={cardDescStyle}>Track and update order statuses.</div>
          </Link>
          <Link to="/admin/sales" style={actionCardStyle}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>📊</div>
            <div style={cardTitleStyle}>Sales Analytics</div>
            <div style={cardDescStyle}>View detailed sales reports and insights.</div>
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
  borderRadius: 16,
  padding: 20,
  display: "block",
  transition: "all .2s",
  cursor: "pointer",
};

const cardTitleStyle: CSSProperties = {
  color: "var(--ink)",
  fontWeight: 800,
  fontSize: 15,
  marginBottom: 6,
};

const cardDescStyle: CSSProperties = {
  color: "var(--ink-4)",
  fontSize: 12,
  lineHeight: 1.4,
};
