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

const PAGE_SIZE = 10;

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
  const [page, setPage] = useState(1);
  const [activeOrder, setActiveOrder] = useState<OrderRow | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{
    id: string;
    nextStatus: string;
  } | null>(null);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
    setActiveOrder((prev) =>
      prev && prev.id === id
        ? {
            ...prev,
            status: selected.status,
            progress: selected.progress,
          }
        : prev,
    );
    push("Order updated");
  };

  const statusTarget =
    pendingStatus && STATUS_OPTIONS.find((s) => s.status === pendingStatus.nextStatus);

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

          <div style={{ marginTop: 10, color: "var(--ink-4)", fontSize: 12 }}>
            Showing {filtered.length === 0 ? 0 : pageStart + 1}-
            {Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
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
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((o) => (
                    <tr key={o.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={tdStyle}>{o.order_code}</td>
                      <td style={tdStyle}>{o.user_id.slice(0, 8)}…</td>
                      <td style={tdStyle}>Rs {o.total.toLocaleString()}</td>
                      <td style={tdStyle}>
                        <select
                          value={o.status}
                          onChange={(e) =>
                            setPendingStatus({ id: o.id, nextStatus: e.target.value })
                          }
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
                      <td style={tdStyle}>
                        <button onClick={() => setActiveOrder(o)} style={miniBtnStyle}>
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={miniBtnStyle}
              >
                Previous
              </button>
              <span style={{ color: "var(--ink-4)", fontSize: 12 }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={miniBtnStyle}
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>

      {pendingStatus && statusTarget && (
        <ConfirmDialog
          title="Update order status"
          body={`Change this order to ${statusTarget.status} (${statusTarget.progress}% progress)?`}
          onCancel={() => setPendingStatus(null)}
          onConfirm={async () => {
            await patchOrder(pendingStatus.id, pendingStatus.nextStatus);
            setPendingStatus(null);
          }}
        />
      )}

      {activeOrder && (
        <OrderDetailsDrawer order={activeOrder} onClose={() => setActiveOrder(null)} />
      )}
    </AdminGate>
  );
}

function ConfirmDialog({
  title,
  body,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 18, color: "var(--ink)" }}>{title}</h3>
        <p style={{ marginTop: 8, marginBottom: 16, color: "var(--ink-4)", fontSize: 14 }}>
          {body}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel} style={miniBtnStyle}>
            Cancel
          </button>
          <button onClick={onConfirm} style={miniDangerBtnStyle}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderDetailsDrawer({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div style={drawerOverlayStyle} onClick={onClose}>
      <aside style={drawerStyle} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 20, color: "var(--ink)" }}>Order {order.order_code}</h3>
          <button onClick={onClose} style={miniBtnStyle}>
            Close
          </button>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          <DetailRow label="Status" value={`${order.status} (${order.progress}%)`} />
          <DetailRow label="Placed" value={new Date(order.created_at).toLocaleString()} />
          <DetailRow label="Payment" value={order.payment} />
          <DetailRow label="Address" value={order.address} />
          <DetailRow label="Subtotal" value={`Rs ${order.subtotal.toLocaleString()}`} />
          <DetailRow label="Shipping" value={`Rs ${order.shipping.toLocaleString()}`} />
          <DetailRow label="Total" value={`Rs ${order.total.toLocaleString()}`} />
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>
            Items
          </div>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
            {items.length === 0 ? (
              <div style={{ padding: 12, color: "var(--ink-4)", fontSize: 13 }}>
                No order items recorded.
              </div>
            ) : (
              items.map((item: any, idx: number) => (
                <div
                  key={`${item.id || "item"}-${idx}`}
                  style={{
                    padding: "10px 12px",
                    borderTop: idx === 0 ? "none" : "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "var(--ink)" }}>{item.id || item.name || "Item"}</span>
                  <span style={{ color: "var(--ink-4)" }}>Qty {item.qty || 1}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 12, color: "var(--ink-4)", fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--ink)" }}>{value}</span>
    </div>
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

const miniBtnStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
};

const miniDangerBtnStyle: CSSProperties = {
  ...miniBtnStyle,
  border: "1px solid var(--pill-rose-fg)",
  color: "var(--pill-rose-fg)",
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(10,15,28,.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 120,
};

const dialogStyle: CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: 16,
};

const drawerOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(10,15,28,.35)",
  display: "flex",
  justifyContent: "flex-end",
  zIndex: 120,
};

const drawerStyle: CSSProperties = {
  width: "100%",
  maxWidth: 480,
  height: "100%",
  overflowY: "auto",
  background: "var(--card)",
  borderLeft: "1px solid var(--line)",
  padding: 18,
};
