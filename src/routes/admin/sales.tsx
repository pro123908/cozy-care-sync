import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { getSupabase } from "@/integrations/supabase/client";
import { AdminGate } from "@/wcm/admin-access";
import { WellcareLoader } from "@/wcm/loader";
import { NOINDEX_FOLLOW_META, canonicalUrl } from "@/lib/seo";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/admin/sales")({
  component: AdminSalesPage,
  head: () => ({
    links: [{ rel: "canonical", href: canonicalUrl("/admin/sales") }],
    meta: [{ title: "Sales Report — Wellcare Mart Admin" }, NOINDEX_FOLLOW_META],
  }),
});

type PriceHistoryEntry = {
  product_id: string;
  unit_price: number;
  qty_sold: number;
};

type SalesRow = {
  id: string;
  name: string;
  brand: string;
  cat: string;
  price: number;
  purchase_price: number;
  sales_count: number;
  total_revenue: number; // sum of unit_price*qty from order items — accurate even if price changed later
  active: boolean;
  image_url: string | null;
  stock: string;
};

const PKR = (n: number) => "Rs. " + n.toLocaleString("en-PK", { maximumFractionDigits: 0 });

const TIER_COLORS = {
  hot: { bg: "rgba(16,185,129,0.08)", border: "#10b981", text: "#065f46", label: "Hot", dot: "#10b981" },
  warm: { bg: "rgba(245,158,11,0.08)", border: "#f59e0b", text: "#92400e", label: "Warm", dot: "#f59e0b" },
  cold: { bg: "rgba(148,163,184,0.08)", border: "#94a3b8", text: "#475569", label: "Cold", dot: "#94a3b8" },
};

function getTier(count: number, max: number) {
  if (count >= max * 0.6) return "hot";
  if (count >= max * 0.2) return "warm";
  return "cold";
}

const RANK_MEDAL = ["🥇", "🥈", "🥉"];

function AdminSalesPage() {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"sales_count" | "name" | "price" | "profit">("sales_count");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeChartBar, setActiveChartBar] = useState<string | null>(null);

  const isMobile = useIsMobile();

  const fetchSalesRows = async () => {
    const supabase = await getSupabase();
    const [productsResult, statsResult] = await Promise.all([
      supabase.from("products").select("id, name, brand, cat, price, purchase_price, active, image_url, stock"),
      supabase.rpc("product_sales_stats"),
    ]);

    const products = (productsResult.data ?? []) as Omit<SalesRow, "sales_count" | "total_revenue">[];
    const statsMap = new Map<string, { sales_count: number; total_revenue: number }>(
      ((statsResult.data ?? []) as { product_id: string; sales_count: string; total_revenue: string }[]).map((s) => [
        s.product_id,
        { sales_count: Number(s.sales_count), total_revenue: Number(s.total_revenue) },
      ])
    );

    return products.map((p) => ({
      ...p,
      sales_count: statsMap.get(p.id)?.sales_count ?? 0,
      total_revenue: statsMap.get(p.id)?.total_revenue ?? 0,
    })) as SalesRow[];
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = await getSupabase();
      const [data, histResult] = await Promise.all([
        fetchSalesRows(),
        supabase.rpc("product_price_history"),
      ]);
      if (cancelled) return;
      setRows(data);
      setPriceHistory(
        ((histResult.data ?? []) as { product_id: string; unit_price: string; qty_sold: string }[]).map((h) => ({
          product_id: h.product_id,
          unit_price: Number(h.unit_price),
          qty_sold: Number(h.qty_sold),
        }))
      );
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const handleRecalculate = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.rpc("recalculate_product_sales_counts");
      if (error) { setSyncMessage(error.message || "Failed."); return; }
      const data = await fetchSalesRows();
      setRows(data);
      setSyncMessage("Recalculated successfully.");
    } catch {
      setSyncMessage("Failed to recalculate.");
    } finally {
      setSyncing(false);
    }
  };

  const totalSales = useMemo(() => rows.reduce((s, r) => s + r.sales_count, 0), [rows]);

  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const totalRevenue = rows.reduce((sum, r) => sum + r.total_revenue, 0);
    const avgRevenue = totalRevenue / rows.length;
    const bestRevenueProduct = rows.reduce((best, r) =>
      r.total_revenue > best.total_revenue ? r : best
    );
    const totalProfit = rows.reduce((sum, r) => {
      if (r.purchase_price <= 0 || r.sales_count === 0) return sum;
      return sum + (r.total_revenue - r.purchase_price * r.sales_count);
    }, 0);
    const bestProfitProduct = rows
      .filter((r) => r.purchase_price > 0 && r.sales_count > 0)
      .reduce<SalesRow | null>((best, r) => {
        const profit = r.total_revenue - r.purchase_price * r.sales_count;
        const bestProfit = best ? best.total_revenue - best.purchase_price * best.sales_count : -Infinity;
        return profit > bestProfit ? r : best;
      }, null);
    const zeroSalesCount = rows.filter((r) => r.sales_count === 0).length;
    const meanSales = totalSales / rows.length;
    const lowStockCount = rows.filter((r) => {
      const s = r.stock.trim().toLowerCase();
      return s === "low stock" || s === "out of stock";
    }).length;
    const sortedSales = [...rows.map((r) => r.sales_count)].sort((a, b) => a - b);
    const medianSales = sortedSales[Math.floor(sortedSales.length / 2)];
    const topProducts = [...rows].sort((a, b) => b.sales_count - a.sales_count).slice(0, 5);
    const slowestProducts = [...rows].sort((a, b) => a.sales_count - b.sales_count).slice(0, 5);

    const categoryMap = new Map<string, { volume: number; revenue: number; productCount: number }>();
    rows.forEach((r) => {
      if (!categoryMap.has(r.cat)) categoryMap.set(r.cat, { volume: 0, revenue: 0, productCount: 0 });
      const cat = categoryMap.get(r.cat)!;
      cat.volume += r.sales_count;
      cat.revenue += r.total_revenue;
      cat.productCount += 1;
    });
    const categoryStats = Array.from(categoryMap.entries())
      .map(([name, s]) => ({ name, ...s, avgPerProduct: s.volume / s.productCount }))
      .sort((a, b) => b.volume - a.volume);

    return {
      totalRevenue, avgRevenue, bestRevenueProduct,
      totalProfit, bestProfitProduct,
      zeroSalesCount, meanSales, lowStockCount, medianSales,
      topProducts, slowestProducts, categoryStats,
      topCategoryByVolume: categoryStats[0],
    };
  }, [rows, totalSales]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let arr = rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.brand.toLowerCase().includes(q) || r.cat.toLowerCase().includes(q),
    );
    arr = [...arr].sort((a, b) => {
      let diff = 0;
      if (sortBy === "sales_count") diff = a.sales_count - b.sales_count;
      else if (sortBy === "price") diff = a.price - b.price;
      else if (sortBy === "profit") diff = (a.total_revenue - a.purchase_price * a.sales_count) - (b.total_revenue - b.purchase_price * b.sales_count);
      else diff = a.name.localeCompare(b.name);
      return sortDir === "desc" ? -diff : diff;
    });
    return arr;
  }, [rows, query, sortBy, sortDir]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const totalPages = Math.ceil(filtered.length / pageSize);

  useEffect(() => { setPage(1); }, [query]);

  const maxSales = useMemo(() => Math.max(1, ...rows.map((r) => r.sales_count)), [rows]);

  const chartData = useMemo(() =>
    (stats?.categoryStats ?? []).slice(0, 8).map((c) => ({
      name: c.name.length > 14 ? c.name.slice(0, 13) + "…" : c.name,
      fullName: c.name,
      units: c.volume,
      revenue: Math.round(c.revenue / 1000),
    })),
    [stats]
  );

  const SortIcon = ({ col }: { col: typeof sortBy }) =>
    sortBy === col ? (
      <span style={{ marginLeft: 4, fontSize: 11 }}>{sortDir === "desc" ? "↓" : "↑"}</span>
    ) : (
      <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.3 }}>↕</span>
    );

  return (
    <AdminGate>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: isMobile ? "0" : "30px 20px 90px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <Link to="/admin" style={{ color: "var(--ink-4)", textDecoration: "none", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
              ← Admin
            </Link>
            <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 800, letterSpacing: -0.4, color: "var(--ink)" }}>
              Sales Analytics
            </h1>
            <p style={{ margin: "4px 0 0", color: "var(--ink-4)", fontSize: 13 }}>
              Units sold, revenue, and performance by product & category.
            </p>
            {syncMessage && (
              <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 700, color: syncMessage.includes("success") ? "#059669" : "#e11d48" }}>
                {syncMessage}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRecalculate}
            disabled={syncing}
            style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", fontSize: 12, fontWeight: 700, cursor: syncing ? "default" : "pointer", opacity: syncing ? 0.7 : 1, fontFamily: "inherit", width: isMobile ? "100%" : undefined }}
          >
            {syncing ? "Recalculating…" : "↻ Recalculate"}
          </button>
        </div>

        {loading ? (
          <WellcareLoader label="Loading analytics" compact minHeight={200} />
        ) : (
          <>
            {/* ── Hero revenue card ── */}
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 18,
                overflow: "hidden",
                marginBottom: 20,
              }}
            >
              {/* Accent bar */}
              <div style={{ height: 4, background: "linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4)" }} />

              <div style={{ padding: isMobile ? "20px 18px" : "28px 32px" }}>
                {/* Revenue */}
                <div style={{ marginBottom: isMobile ? 18 : 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
                    Total Revenue
                  </div>
                  <div style={{ fontSize: isMobile ? 36 : 52, fontWeight: 900, letterSpacing: -1.5, color: "var(--ink)", lineHeight: 1 }}>
                    {PKR(stats?.totalRevenue ?? 0)}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 8, fontWeight: 500 }}>
                    from {rows.length} products
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: "var(--line)", marginBottom: isMobile ? 18 : 24 }} />

                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 16 : 0 }}>
                  {[
                    { label: "Units sold", value: totalSales.toLocaleString(), color: "#6366f1" },
                    { label: "Total profit", value: PKR(stats?.totalProfit ?? 0), color: "#10b981" },
                    { label: "Products tracked", value: String(rows.length), color: "#06b6d4" },
                    { label: "Avg rev / product", value: PKR(stats?.avgRevenue ?? 0), color: "#8b5cf6" },
                  ].map(({ label, value, color }, i, arr) => (
                    <div
                      key={label}
                      style={{
                        paddingLeft: !isMobile && i > 0 ? 28 : 0,
                        borderLeft: !isMobile && i > 0 ? "1px solid var(--line)" : "none",
                        paddingRight: !isMobile && i < arr.length - 1 ? 28 : 0,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color, letterSpacing: -0.5 }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Insight chips ── */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
              <div style={insightCard("#f0fdf4", "#16a34a")}>
                <div style={insightIcon("🏆")} />
                <div style={insightLabel}>Top seller</div>
                <div style={insightValue}>{stats?.topProducts[0]?.name ?? "—"}</div>
                <div style={insightSub}>{stats?.topProducts[0]?.sales_count ?? 0} units</div>
              </div>
              <div style={insightCard("#ecfdf5", "#059669")}>
                <div style={insightIcon("💰")} />
                <div style={insightLabel}>Most profitable</div>
                <div style={insightValue}>{stats?.bestProfitProduct?.name ?? "—"}</div>
                <div style={insightSub}>
                  {stats?.bestProfitProduct
                    ? `${PKR(stats.bestProfitProduct.total_revenue - stats.bestProfitProduct.purchase_price * stats.bestProfitProduct.sales_count)} profit`
                    : "No data yet"}
                </div>
              </div>
              <div style={insightCard("#fff7ed", "#ea580c")}>
                <div style={insightIcon("📦")} />
                <div style={insightLabel}>Zero sales</div>
                <div style={{ ...insightValue, fontSize: 26 }}>{stats?.zeroSalesCount ?? 0}</div>
                <div style={insightSub}>products need attention</div>
              </div>
              <div style={insightCard("#fef2f2", "#dc2626")}>
                <div style={insightIcon("⚠️")} />
                <div style={insightLabel}>Low / out of stock</div>
                <div style={{ ...insightValue, fontSize: 26 }}>{stats?.lowStockCount ?? 0}</div>
                <div style={insightSub}>need restocking</div>
              </div>
              <div style={insightCard("#f0f9ff", "#0284c7")}>
                <div style={insightIcon("📊")} />
                <div style={insightLabel}>Median sales</div>
                <div style={{ ...insightValue, fontSize: 26 }}>{stats?.medianSales ?? 0}</div>
                <div style={insightSub}>units per product</div>
              </div>
            </div>

            {/* ── Category bar chart ── */}
            {chartData.length > 0 && (
              <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: isMobile ? "16px 12px" : "20px 24px", marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>Sales by category</div>
                <div style={{ fontSize: 12, color: "var(--ink-4)", marginBottom: 16 }}>Units sold and revenue (Rs. thousands) per category</div>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={4}
                    onMouseLeave={() => setActiveChartBar(null)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="name" tick={{ fontSize: isMobile ? 9 : 11, fill: "var(--ink-4)", fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--ink-4)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
                            <div style={{ fontWeight: 800, marginBottom: 6, color: "var(--ink)" }}>{d.fullName}</div>
                            <div style={{ color: "#6366f1" }}>Units: <strong>{d.units}</strong></div>
                            <div style={{ color: "#10b981" }}>Revenue: <strong>Rs. {(d.revenue * 1000).toLocaleString()}</strong></div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12, paddingTop: 8 }} />
                    <Bar dataKey="units" name="Units sold" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={40}
                      onMouseEnter={(d) => setActiveChartBar(d.fullName)}>
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={activeChartBar === entry.fullName ? "#4f46e5" : "#6366f1"} />
                      ))}
                    </Bar>
                    <Bar dataKey="revenue" name="Revenue (Rs k)" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Top 5 leaderboard ── */}
            {stats && stats.topProducts.length > 0 && (
              <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, marginBottom: 20, overflow: "hidden" }}>
                <div style={{ padding: isMobile ? "14px 14px 10px" : "18px 20px 12px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>🏆 Leaderboard</div>
                    <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>Top 5 products by units sold</div>
                  </div>
                </div>
                {stats.topProducts.map((p, i) => {
                  const pct = Math.round((p.sales_count / maxSales) * 100);
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: isMobile ? "12px 14px" : "14px 20px",
                        borderBottom: i < stats.topProducts.length - 1 ? "1px solid var(--line)" : "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: i === 0 ? "linear-gradient(90deg, rgba(253,224,71,0.08) 0%, transparent 60%)" : "transparent",
                      }}
                    >
                      <div style={{ fontSize: i < 3 ? 22 : 14, fontWeight: 800, color: i < 3 ? "inherit" : "var(--ink-4)", minWidth: 28, textAlign: "center" }}>
                        {i < 3 ? RANK_MEDAL[i] : `#${i + 1}`}
                      </div>
                      {p.image_url && (
                        <div style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", flexShrink: 0, border: "1px solid var(--line)" }}>
                          <img src={p.image_url} alt={p.name} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.name}
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: "var(--line)", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", width: `${pct}%`, borderRadius: 999,
                            background: i === 0 ? "linear-gradient(90deg, #f59e0b, #f97316)" : i === 1 ? "#94a3b8" : i === 2 ? "#b45309" : "#6366f1",
                            transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
                          }} />
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{p.sales_count}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-4)" }}>units</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Slowest sellers ── */}
            {stats && stats.slowestProducts.length > 0 && (
              <div style={{ background: "var(--card)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, marginBottom: 20, overflow: "hidden" }}>
                <div style={{ padding: isMobile ? "14px 14px 10px" : "18px 20px 12px", borderBottom: "1px solid rgba(239,68,68,0.15)", background: "rgba(254,242,242,0.5)" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#dc2626" }}>🐢 Slowest sellers</div>
                  <div style={{ fontSize: 12, color: "#ef4444", marginTop: 2, opacity: 0.8 }}>Products that need a push</div>
                </div>
                {stats.slowestProducts.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      padding: isMobile ? "11px 14px" : "13px 20px",
                      borderBottom: i < stats.slowestProducts.length - 1 ? "1px solid rgba(239,68,68,0.1)" : "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>{p.brand} · {p.cat}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: p.sales_count === 0 ? "#dc2626" : "var(--ink)" }}>
                        {p.sales_count} units
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>{PKR(p.price)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Sale Price History ── */}
            <PriceHistorySection priceHistory={priceHistory} rows={rows} isMobile={isMobile} />

            {/* ── Search & controls ── */}
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10, marginBottom: 12, alignItems: isMobile ? "stretch" : "center" }}>
              <input
                placeholder="Search by product, brand or category…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-4)" }}>Per page:</label>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", fontSize: 13, fontWeight: 600, cursor: "pointer", outline: "none" }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* ── Product list ── */}
            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>No products match your search.</div>
            ) : isMobile ? (
              <>
                {/* Mobile sort pills */}
                <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                  {(["sales_count", "profit", "name", "price"] as const).map((col) => (
                    <button key={col} onClick={() => toggleSort(col)} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--line)", background: sortBy === col ? "var(--ink)" : "var(--card)", color: sortBy === col ? "var(--card)" : "var(--ink-4)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      {col === "sales_count" ? "Units" : col === "profit" ? "Profit" : col === "name" ? "Name" : "Price"}
                      <SortIcon col={col} />
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {paginatedRows.map((row, i) => {
                    const tier = getTier(row.sales_count, maxSales);
                    const tc = TIER_COLORS[tier];
                    return (
                      <div key={row.id} style={{ border: `1px solid var(--line)`, borderLeft: `3px solid ${tc.border}`, borderRadius: 12, padding: "12px 14px", background: "var(--card)" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)", minWidth: 20, paddingTop: 2 }}>{(page - 1) * pageSize + i + 1}</div>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--chip)", border: "1px solid var(--line)", overflow: "hidden", flexShrink: 0 }}>
                            {row.image_url ? <img src={row.image_url} alt={row.name} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : null}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>{row.name}</div>
                              <span style={{ padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700, flexShrink: 0, background: tc.bg, color: tc.text }}>{tc.label}</span>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>{row.brand} · {row.cat}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                              <div style={{ flex: 1, height: 5, borderRadius: 999, background: "var(--line)" }}>
                                <div style={{ height: "100%", width: `${Math.round((row.sales_count / maxSales) * 100)}%`, borderRadius: 999, background: tc.dot, transition: "width .3s ease" }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", minWidth: 24, textAlign: "right" }}>{row.sales_count}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)" }}>{PKR(row.price)}</span>
                            </div>
                            {row.purchase_price > 0 && row.sales_count > 0 && (
                              <div style={{ marginTop: 6, fontSize: 11, color: "#10b981", fontWeight: 700 }}>
                                Avg profit/unit: {PKR(Math.round(row.total_revenue / row.sales_count) - row.purchase_price)} · Total: {PKR(row.total_revenue - row.purchase_price * row.sales_count)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--bg-elev, var(--chip))" }}>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}><button style={sortBtnStyle} onClick={() => toggleSort("name")}>Product <SortIcon col="name" /></button></th>
                        <th style={thStyle}>Brand</th>
                        <th style={thStyle}>Tier</th>
                        <th style={thStyle}><button style={sortBtnStyle} onClick={() => toggleSort("price")}>Price <SortIcon col="price" /></button></th>
                        <th style={thStyle}>Profit / unit</th>
                        <th style={thStyle}><button style={sortBtnStyle} onClick={() => toggleSort("profit")}>Total profit <SortIcon col="profit" /></button></th>
                        <th style={{ ...thStyle, minWidth: 200 }}><button style={sortBtnStyle} onClick={() => toggleSort("sales_count")}>Units sold <SortIcon col="sales_count" /></button></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row, i) => {
                        const tier = getTier(row.sales_count, maxSales);
                        const tc = TIER_COLORS[tier];
                        return (
                          <tr key={row.id} style={{ borderTop: "1px solid var(--line)", background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.012)" }}>
                            <td style={{ ...tdStyle, width: 36, color: "var(--ink-4)", fontSize: 12, fontWeight: 700 }}>{(page - 1) * pageSize + i + 1}</td>
                            <td style={{ ...tdStyle, minWidth: 220 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--chip)", border: "1px solid var(--line)", overflow: "hidden", flexShrink: 0 }}>
                                  {row.image_url ? <img src={row.image_url} alt={row.name} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : null}
                                </div>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>{row.name}</div>
                                  <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>{row.cat}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ ...tdStyle, fontSize: 13, color: "var(--ink-3)" }}>{row.brand}</td>
                            <td style={tdStyle}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: tc.bg, color: tc.text }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: tc.dot, flexShrink: 0 }} />
                                {tc.label}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{PKR(row.price)}</td>
                            <td style={tdStyle}>
                              {row.purchase_price > 0 && row.sales_count > 0 ? (
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>
                                  {PKR(Math.round(row.total_revenue / row.sales_count) - row.purchase_price)}
                                </span>
                              ) : <span style={{ color: "var(--ink-4)", fontSize: 12 }}>—</span>}
                            </td>
                            <td style={tdStyle}>
                              {row.purchase_price > 0 && row.sales_count > 0 ? (() => {
                                const totalProfit = row.total_revenue - row.purchase_price * row.sales_count;
                                const avgUnitPrice = row.total_revenue / row.sales_count;
                                const margin = Math.round(((avgUnitPrice - row.purchase_price) / avgUnitPrice) * 100);
                                return (
                                  <div>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>
                                      {PKR(totalProfit)}
                                    </span>
                                    <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>
                                      {margin}% margin
                                    </div>
                                  </div>
                                );
                              })() : <span style={{ color: "var(--ink-4)", fontSize: 12 }}>—</span>}
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--line)", minWidth: 80 }}>
                                  <div style={{ height: "100%", width: `${Math.round((row.sales_count / maxSales) * 100)}%`, borderRadius: 999, background: tc.dot, transition: "width .3s ease" }} />
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", minWidth: 28, textAlign: "right" }}>{row.sales_count}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Pagination ── */}
            {filtered.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, padding: "12px 0", fontSize: 13, color: "var(--ink-4)", flexWrap: "wrap", gap: 12 }}>
                <div>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={pageBtn(page === 1)}>← Prev</button>
                  <div style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--chip)", fontWeight: 700, fontSize: 12 }}>{page} / {totalPages}</div>
                  <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={pageBtn(page === totalPages)}>Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminGate>
  );
}

function PriceHistorySection({
  priceHistory,
  rows,
  isMobile,
}: {
  priceHistory: PriceHistoryEntry[];
  rows: SalesRow[];
  isMobile: boolean;
}) {
  const productMap = new Map(rows.map((r) => [r.id, r]));

  // Group history entries by product, keeping only products that have sales
  type ProductHistory = {
    product: SalesRow;
    entries: PriceHistoryEntry[];
    hasPriceChange: boolean;
  };
  const grouped: ProductHistory[] = [];
  const seen = new Set<string>();

  for (const entry of priceHistory) {
    if (seen.has(entry.product_id)) continue;
    seen.add(entry.product_id);
    const product = productMap.get(entry.product_id);
    if (!product) continue;
    const entries = priceHistory.filter((h) => h.product_id === entry.product_id);
    const hasPriceChange = entries.some((h) => h.unit_price !== product.price);
    grouped.push({ product, entries, hasPriceChange });
  }

  if (grouped.length === 0) return null;

  const changedCount = grouped.filter((g) => g.hasPriceChange).length;

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, marginBottom: 20, overflow: "hidden" }}>
      <div style={{ padding: isMobile ? "14px 14px 10px" : "18px 20px 12px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>🏷️ Prices at time of sale</div>
          <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>
            What customers actually paid — not affected by price changes.
            {changedCount > 0 && (
              <span style={{ marginLeft: 8, background: "rgba(245,158,11,0.12)", color: "#b45309", padding: "1px 7px", borderRadius: 999, fontWeight: 700 }}>
                {changedCount} price {changedCount === 1 ? "change" : "changes"} detected
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 520 : 700 }}>
          <thead>
            <tr style={{ background: "var(--bg-elev, var(--chip))" }}>
              <th style={thStyle}>Product</th>
              <th style={thStyle}>Sold at price</th>
              <th style={thStyle}>Units</th>
              <th style={thStyle}>Current price</th>
              <th style={thStyle}>Difference</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ product, entries, hasPriceChange }, gi) => (
              entries.map((entry, ei) => {
                const diff = entry.unit_price - product.price;
                const isChanged = entry.unit_price !== product.price;
                return (
                  <tr
                    key={`${product.id}-${entry.unit_price}`}
                    style={{
                      borderTop: ei === 0 && gi > 0 ? "2px solid var(--line)" : "1px solid var(--line)",
                      background: isChanged ? "rgba(245,158,11,0.04)" : "transparent",
                    }}
                  >
                    <td style={{ ...tdStyle, minWidth: 200 }}>
                      {ei === 0 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {product.image_url && (
                            <div style={{ width: 32, height: 32, borderRadius: 7, overflow: "hidden", border: "1px solid var(--line)", flexShrink: 0 }}>
                              <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{product.name}</div>
                            <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{product.brand}</div>
                          </div>
                          {hasPriceChange && (
                            <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(245,158,11,0.15)", color: "#b45309", padding: "2px 6px", borderRadius: 999, whiteSpace: "nowrap" }}>
                              price changed
                            </span>
                          )}
                        </div>
                      ) : (
                        <div style={{ paddingLeft: product.image_url ? 40 : 0 }} />
                      )}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700, fontSize: 13, color: isChanged ? "#b45309" : "var(--ink)" }}>
                      {PKR(entry.unit_price)}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 13, color: "var(--ink-4)", fontWeight: 600 }}>
                      {entry.qty_sold}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 13, color: "var(--ink)", fontWeight: isChanged ? 700 : 400 }}>
                      {ei === 0 ? PKR(product.price) : <span style={{ color: "var(--ink-4)", fontSize: 11 }}>↑</span>}
                    </td>
                    <td style={tdStyle}>
                      {isChanged ? (
                        <span style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: diff > 0 ? "#10b981" : "#ef4444",
                          background: diff > 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                          padding: "2px 8px",
                          borderRadius: 999,
                          whiteSpace: "nowrap",
                        }}>
                          {diff > 0 ? "+" : ""}{PKR(diff)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--ink-4)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const pageBtn = (disabled: boolean): CSSProperties => ({
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: disabled ? "var(--ink-4)" : "var(--ink)",
  fontSize: 13,
  fontWeight: 700,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.5 : 1,
  fontFamily: "inherit",
});

const insightCard = (bg: string, accent: string): CSSProperties => ({
  background: bg,
  border: `1px solid ${accent}22`,
  borderTop: `3px solid ${accent}`,
  borderRadius: 14,
  padding: "14px 14px 12px",
});
const insightIcon = (emoji: string) => ({ fontSize: 20, lineHeight: 1, marginBottom: 6, display: "block" as const, content: emoji });
const insightLabel: CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 };
const insightValue: CSSProperties = { fontSize: 16, fontWeight: 800, color: "var(--ink)", lineHeight: 1.2, marginBottom: 4 };
const insightSub: CSSProperties = { fontSize: 11, color: "var(--ink-4)" };

const thStyle: CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--ink-4)",
  letterSpacing: 0.3,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = { padding: "11px 14px", verticalAlign: "middle" };

const sortBtnStyle: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  fontSize: 11,
  fontWeight: 700,
  color: "var(--ink-4)",
  letterSpacing: 0.3,
  textTransform: "uppercase",
  display: "inline-flex",
  alignItems: "center",
  fontFamily: "inherit",
};
