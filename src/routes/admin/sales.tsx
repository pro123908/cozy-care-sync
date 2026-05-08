import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import { AdminGate } from "@/wcm/admin-access";
import { WellcareLoader } from "@/wcm/loader";

export const Route = createFileRoute("/admin/sales")({
  component: AdminSalesPage,
  head: () => ({
    meta: [{ title: "Sales Report — Wellcare Mart Admin" }],
  }),
});

type SalesRow = {
  id: string;
  name: string;
  brand: string;
  cat: string;
  price: number;
  sales_count: number;
  active: boolean;
  image_url: string | null;
  stock: string;
};

const PKR = (n: number) => "Rs. " + n.toLocaleString("en-PK", { maximumFractionDigits: 0 });

function AdminSalesPage() {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"sales_count" | "name" | "price">("sales_count");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = await getSupabase();
      let { data, error } = await supabase
        .from("products")
        .select("id, name, brand, cat, price, sales_count, active, image_url, stock")
        .order("sales_count", { ascending: false });
      if (error) {
        const fallback = await supabase
          .from("products")
          .select("id, name, brand, cat, price, active, image_url, stock")
          .order("name", { ascending: true });
        data = fallback.data;
      }
      if (cancelled) return;
      setRows(((data as SalesRow[]) ?? []).map((r) => ({ ...r, sales_count: r.sales_count ?? 0 })));
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalSales = useMemo(() => rows.reduce((s, r) => s + r.sales_count, 0), [rows]);
  const topProduct = useMemo(
    () => rows.reduce((best, r) => (r.sales_count > (best?.sales_count ?? -1) ? r : best), rows[0]),
    [rows],
  );

  const stats = useMemo(() => {
    if (rows.length === 0) return null;

    const totalRevenue = rows.reduce((sum, r) => sum + r.price * r.sales_count, 0);
    const avgRevenue = totalRevenue / rows.length;
    const bestRevenueProduct = rows.reduce((best, r) => {
      const revA = best.price * best.sales_count;
      const revB = r.price * r.sales_count;
      return revB > revA ? r : best;
    });

    const zeroSalesCount = rows.filter((r) => r.sales_count === 0).length;
    const meanSales = totalSales / rows.length;
    const aboveAvgCount = rows.filter((r) => r.sales_count > meanSales).length;
    const belowAvgCount = rows.filter((r) => r.sales_count < meanSales && r.sales_count > 0).length;

    const lowStockCount = rows.filter((r) => {
      const stock = r.stock.trim().toLowerCase();
      return stock === "low stock" || stock === "out of stock";
    }).length;

    const sortedSales = [...rows.map((r) => r.sales_count)].sort((a, b) => a - b);
    const medianSales = sortedSales[Math.floor(sortedSales.length / 2)];

    const slowestProducts = [...rows].sort((a, b) => a.sales_count - b.sales_count).slice(0, 5);

    const categoryMap = new Map<
      string,
      { volume: number; revenue: number; productCount: number }
    >();
    rows.forEach((r) => {
      if (!categoryMap.has(r.cat)) {
        categoryMap.set(r.cat, { volume: 0, revenue: 0, productCount: 0 });
      }
      const cat = categoryMap.get(r.cat)!;
      cat.volume += r.sales_count;
      cat.revenue += r.price * r.sales_count;
      cat.productCount += 1;
    });

    const categoryStats = Array.from(categoryMap.entries())
      .map(([name, stats]) => ({
        name,
        ...stats,
        avgPerProduct: stats.volume / stats.productCount,
      }))
      .sort((a, b) => b.volume - a.volume);

    const topCategoryByVolume = categoryStats[0];
    const topCategoryByRevenue = [...categoryStats].sort((a, b) => b.revenue - a.revenue)[0];

    return {
      totalRevenue,
      avgRevenue,
      bestRevenueProduct,
      zeroSalesCount,
      meanSales,
      aboveAvgCount,
      belowAvgCount,
      lowStockCount,
      medianSales,
      slowestProducts,
      categoryStats,
      topCategoryByVolume,
      topCategoryByRevenue,
    };
  }, [rows, totalSales]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let arr = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.brand.toLowerCase().includes(q) ||
        r.cat.toLowerCase().includes(q),
    );
    arr = [...arr].sort((a, b) => {
      let diff = 0;
      if (sortBy === "sales_count") diff = a.sales_count - b.sales_count;
      else if (sortBy === "price") diff = a.price - b.price;
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

  const handlePageChange = (newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)));
  };

  useEffect(() => {
    setPage(1);
  }, [query]);

  const maxSales = useMemo(() => Math.max(1, ...rows.map((r) => r.sales_count)), [rows]);

  const SortIcon = ({ col }: { col: typeof sortBy }) =>
    sortBy === col ? (
      <span style={{ marginLeft: 4, fontSize: 11 }}>{sortDir === "desc" ? "↓" : "↑"}</span>
    ) : (
      <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.3 }}>↕</span>
    );

  return (
    <AdminGate>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "30px 20px 90px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 22,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Link
                to="/admin"
                style={{
                  color: "var(--ink-4)",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ← Admin
              </Link>
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: -0.4,
                color: "var(--ink)",
              }}
            >
              Sales Report
            </h1>
            <p style={{ margin: "6px 0 0", color: "var(--ink-4)", fontSize: 14 }}>
              Units sold per product, tracked from orders.
            </p>
          </div>
        </div>

        {/* Metric cards */}
        <div style={{ marginBottom: 24 }}>
          {/* Row 1: Key metrics */}
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              marginBottom: 12,
            }}
          >
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Total units sold</div>
              <div style={{ ...metricValueStyle, fontSize: 24 }}>
                {loading ? "…" : totalSales.toLocaleString()}
              </div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Total revenue</div>
              <div style={{ ...metricValueStyle, fontSize: 18, wordBreak: "break-word" }}>
                {loading ? "…" : PKR(stats?.totalRevenue ?? 0)}
              </div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Products tracked</div>
              <div style={{ ...metricValueStyle, fontSize: 24 }}>{loading ? "…" : rows.length}</div>
            </div>
          </div>

          {/* Row 2: Distribution stats */}
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              marginBottom: 12,
            }}
          >
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Avg revenue/product</div>
              <div style={{ ...metricValueStyle, fontSize: 18, wordBreak: "break-word" }}>
                {loading ? "…" : PKR(stats?.avgRevenue ?? 0)}
              </div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Median sales</div>
              <div style={{ ...metricValueStyle, fontSize: 20 }}>
                {loading ? "…" : (stats?.medianSales ?? 0)}
              </div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Mean sales</div>
              <div style={{ ...metricValueStyle, fontSize: 20 }}>
                {loading ? "…" : Math.round(stats?.meanSales ?? 0)}
              </div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Zero sales count</div>
              <div style={{ ...metricValueStyle, fontSize: 20 }}>
                {loading ? "…" : (stats?.zeroSalesCount ?? 0)}
              </div>
            </div>
          </div>

          {/* Row 3: Product analysis */}
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              marginBottom: 12,
            }}
          >
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Above average</div>
              <div style={{ ...metricValueStyle, fontSize: 20 }}>
                {loading ? "…" : (stats?.aboveAvgCount ?? 0)}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6 }}>
                performing better than mean
              </div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Below average</div>
              <div style={{ ...metricValueStyle, fontSize: 20 }}>
                {loading ? "…" : (stats?.belowAvgCount ?? 0)}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6 }}>
                but still have sales
              </div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Low/out of stock</div>
              <div style={{ ...metricValueStyle, fontSize: 20 }}>
                {loading ? "…" : (stats?.lowStockCount ?? 0)}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6 }}>
                needs restocking
              </div>
            </div>
          </div>

          {/* Row 4: Top performers */}
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Top by revenue</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginTop: 4,
                  lineHeight: 1.4,
                  minHeight: 40,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                {loading ? "…" : stats?.bestRevenueProduct?.name || "—"}
              </div>
              {!loading && stats?.bestRevenueProduct && (
                <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 8 }}>
                  {PKR(stats.bestRevenueProduct.price * stats.bestRevenueProduct.sales_count)}
                </div>
              )}
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Top category (volume)</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginTop: 4,
                  lineHeight: 1.4,
                  minHeight: 40,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                {loading ? "…" : stats?.topCategoryByVolume?.name || "—"}
              </div>
              {!loading && stats?.topCategoryByVolume && (
                <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 8 }}>
                  {stats.topCategoryByVolume.volume} units sold
                </div>
              )}
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Top category (revenue)</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginTop: 4,
                  lineHeight: 1.4,
                  minHeight: 40,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                {loading ? "…" : stats?.topCategoryByRevenue?.name || "—"}
              </div>
              {!loading && stats?.topCategoryByRevenue && (
                <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 8 }}>
                  {PKR(stats.topCategoryByRevenue.revenue)} earned
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        {!loading && stats && stats.categoryStats.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>
              Sales by category
            </h3>
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {/* Header row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 160px 100px",
                  padding: "9px 16px",
                  background: "var(--chip)",
                  borderBottom: "1px solid var(--line)",
                  gap: 12,
                }}
              >
                {["Category", "Units", "Revenue", "Avg/prod"].map((h) => (
                  <div
                    key={h}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--ink-4)",
                      textTransform: "uppercase",
                      letterSpacing: 0.3,
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>
              {stats.categoryStats.map((cat, i) => (
                <div
                  key={cat.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px 160px 100px",
                    padding: "12px 16px",
                    gap: 12,
                    borderBottom:
                      i < stats.categoryStats.length - 1 ? "1px solid var(--line)" : "none",
                    alignItems: "center",
                    background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.012)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                    {cat.name}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>
                    {cat.volume}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                    {PKR(cat.revenue)}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink-3)" }}>
                    {Math.round(cat.avgPerProduct)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slowest sellers */}
        {!loading && stats && stats.slowestProducts.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>
              Slowest sellers
            </h3>
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {stats.slowestProducts.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    padding: "12px 14px",
                    borderBottom:
                      i < stats.slowestProducts.length - 1 ? "1px solid var(--line)" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>
                      {p.brand} • {p.cat}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>
                      {p.sales_count} units
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>
                      {PKR(p.price * p.sales_count)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search & pageSize */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 14,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            placeholder="Search by product, brand or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: 250,
              padding: "9px 14px",
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--card)",
              color: "var(--ink)",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-4)" }}>
              Per page:
            </label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                padding: "7px 12px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--card)",
                color: "var(--ink)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {loading ? (
            <WellcareLoader label="Loading sales data" compact minHeight={120} />
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>
              No products match your search.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-elev, var(--chip))" }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>
                      <button style={sortBtnStyle} onClick={() => toggleSort("name")}>
                        Product <SortIcon col="name" />
                      </button>
                    </th>
                    <th style={thStyle}>Brand</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>
                      <button style={sortBtnStyle} onClick={() => toggleSort("price")}>
                        Price <SortIcon col="price" />
                      </button>
                    </th>
                    <th style={{ ...thStyle, minWidth: 180 }}>
                      <button style={sortBtnStyle} onClick={() => toggleSort("sales_count")}>
                        Units sold <SortIcon col="sales_count" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, i) => (
                    <tr
                      key={row.id}
                      style={{
                        borderTop: "1px solid var(--line)",
                        background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.012)",
                      }}
                    >
                      <td
                        style={{
                          ...tdStyle,
                          width: 36,
                          color: "var(--ink-4)",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {(page - 1) * pageSize + i + 1}
                      </td>
                      <td style={{ ...tdStyle, minWidth: 220 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              background: "var(--chip)",
                              border: "1px solid var(--line)",
                              overflow: "hidden",
                              flexShrink: 0,
                            }}
                          >
                            {row.image_url ? (
                              <img
                                src={row.image_url}
                                alt={row.name}
                                loading="lazy"
                                decoding="async"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  display: "block",
                                }}
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : null}
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--ink)",
                                lineHeight: 1.3,
                              }}
                            >
                              {row.name}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>
                              {row.cat}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontSize: 13, color: "var(--ink-3)" }}>
                        {row.brand}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: row.active
                              ? "var(--pill-success-bg)"
                              : "var(--pill-rose-bg)",
                            color: row.active ? "var(--pill-success-fg)" : "var(--pill-rose-fg)",
                          }}
                        >
                          {row.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td
                        style={{ ...tdStyle, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}
                      >
                        {PKR(row.price)}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 6,
                              borderRadius: 999,
                              background: "var(--line)",
                              minWidth: 60,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.round((row.sales_count / maxSales) * 100)}%`,
                                borderRadius: 999,
                                background:
                                  row.sales_count >= maxSales * 0.7
                                    ? "var(--green-700, #15803d)"
                                    : row.sales_count >= maxSales * 0.3
                                      ? "#f59e0b"
                                      : "var(--ink-4)",
                                transition: "width .3s ease",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: "var(--ink)",
                              minWidth: 28,
                              textAlign: "right",
                            }}
                          >
                            {row.sales_count}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
              padding: "12px 0",
              fontSize: 13,
              color: "var(--ink-4)",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of{" "}
              {filtered.length} products
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: page === 1 ? "var(--ink-4)" : "var(--ink)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: page === 1 ? "default" : "pointer",
                  opacity: page === 1 ? 0.5 : 1,
                }}
              >
                ← Prev
              </button>
              <div
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "var(--chip)",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {page} / {totalPages}
              </div>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: page === totalPages ? "var(--ink-4)" : "var(--ink)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: page === totalPages ? "default" : "pointer",
                  opacity: page === totalPages ? 0.5 : 1,
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ marginTop: 16, color: "var(--ink-4)", fontSize: 13, textAlign: "center" }}>
            No products match your filters.
          </div>
        )}
      </div>
    </AdminGate>
  );
}

const metricCardStyle: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: 16,
};

const metricLabelStyle: CSSProperties = {
  color: "var(--ink-4)",
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 6,
};

const metricValueStyle: CSSProperties = {
  color: "var(--ink)",
  fontSize: 26,
  fontWeight: 800,
  letterSpacing: -0.4,
};

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

const tdStyle: CSSProperties = {
  padding: "11px 14px",
  verticalAlign: "middle",
};

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
