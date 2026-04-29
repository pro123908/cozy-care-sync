import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AdminGate } from "@/wcm/admin-access";
import { useWcm } from "@/wcm/context";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

type StatusOption = {
  status: string;
  progress: number;
};

const STATUS_OPTIONS: StatusOption[] = [
  { status: "Order placed", progress: 20 },
  { status: "Processing", progress: 40 },
  { status: "Out for delivery", progress: 80 },
  { status: "Delivered", progress: 100 },
  { status: "Cancelled", progress: 0 },
];

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrdersPage,
  head: () => ({
    meta: [{ title: "Admin Orders — Wellcare Mart" }],
  }),
});

function AdminOrdersPage() {
  const { push } = useWcm();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      push("Failed to load orders");
      setLoading(false);
      return;
    }

    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (o) =>
        o.order_code.toLowerCase().includes(q) ||
        o.user_id.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const patchOrder = async (id: string, nextStatus: string) => {
    const selected = STATUS_OPTIONS.find((s) => s.status === nextStatus);
    if (!selected) return;

    setSavingId(id);
    const { error } = await supabase
      .from("orders")
      .update({ status: selected.status, progress: selected.progress })
      .eq("id", id);
    setSavingId(null);

    if (error) {
      push("Failed to update order");
      return;
    }

    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: selected.status,
              progress: selected.progress,
            }
          : r,
      ),
    );
    push("Order updated");
  };

  return (
    <AdminGate>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "30px 20px 90px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.4, color: "var(--ink)" }}>
              Orders
            </h1>
            <p style={{ marginTop: 6, marginBottom: 0, color: "var(--ink-4)", fontSize: 14 }}>
              Track all orders and update status in real time.
            </p>
          </div>
          <Link to="/admin/" style={linkBtnStyle}>
            Dashboard
          </Link>
        </div>

        <section style={{ ...cardStyle, marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <h2 style={sectionTitleStyle}>All orders</h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by order code, status, user id"
              style={searchInputStyle}
            />
          </div>

          {loading ? (
            <div style={{ color: "var(--ink-4)", fontSize: 14, marginTop: 10 }}>
              Loading orders…
            </div>
          ) : (
            <div
              style={{
                marginTop: 10,
                border: "1px solid var(--line)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg-elev)", color: "var(--ink-3)" }}>
                    <th style={thStyle}>Order</th>
                    <th style={thStyle}>User</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={tdStyle}>{o.order_code}</td>
                      <td style={tdStyle}>{o.user_id.slice(0, 8)}…</td>
                      <td style={tdStyle}>Rs {o.total.toLocaleString()}</td>
                      <td style={tdStyle}>
                        <select
                          value={o.status}
                          onChange={(e) => patchOrder(o.id, e.target.value)}
                          disabled={savingId === o.id}
                          style={selectStyle}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.status} value={s.status}>
                              {s.status}
                            </option>
                          ))}
                        </select>
                        <div style={{ marginTop: 6, color: "var(--ink-4)", fontSize: 11 }}>
                          Progress: {o.progress}%
                        </div>
                      </td>
                      <td style={tdStyle}>{new Date(o.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminGate>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: 16,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: "var(--ink)",
};

const searchInputStyle: CSSProperties = {
  width: 280,
  maxWidth: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  fontSize: 13,
  background: "var(--bg-elev)",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  fontWeight: 800,
  padding: "9px 12px",
};

const tdStyle: CSSProperties = {
  padding: "10px 12px",
  color: "var(--ink)",
  verticalAlign: "top",
};

const selectStyle: CSSProperties = {
  width: "100%",
  minWidth: 180,
  padding: "8px 10px",
  borderRadius: 9,
  border: "1px solid var(--line)",
  background: "var(--bg-elev)",
  color: "var(--ink)",
  fontFamily: "inherit",
};

const linkBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  textDecoration: "none",
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 700,
};
