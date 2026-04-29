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
  const [segment, setSegment] = useState<"all" | "new" | "active" | "delivered" | "cancelled">(
    "all",
  );
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
    return rows.filter((o) => {
      const queryMatch =
        !q ||
        o.order_code.toLowerCase().includes(q) ||
        o.user_id.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q);

      const segmentMatch =
        segment === "all"
          ? true
          : segment === "new"
            ? o.status === "Order placed"
            : segment === "active"
              ? ["Processing", "Out for delivery"].includes(o.status)
              : segment === "delivered"
                ? o.status === "Delivered"
                : o.status === "Cancelled";

      return queryMatch && segmentMatch;
    });
  }, [rows, query, segment]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, segment]);

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

          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { id: "all", label: "All", count: rows.length },
              {
                id: "new",
                label: "New",
                count: rows.filter((r) => r.status === "Order placed").length,
              },
              {
                id: "active",
                label: "In progress",
                count: rows.filter((r) => ["Processing", "Out for delivery"].includes(r.status))
                  .length,
              },
              {
                id: "delivered",
                label: "Delivered",
                count: rows.filter((r) => r.status === "Delivered").length,
              },
              {
                id: "cancelled",
                label: "Cancelled",
                count: rows.filter((r) => r.status === "Cancelled").length,
              },
            ].map((seg) => (
              <button
                key={seg.id}
                onClick={() => setSegment(seg.id as typeof segment)}
                style={{
                  border:
                    segment === seg.id ? "1px solid var(--blue-600)" : "1px solid var(--line)",
                  background: segment === seg.id ? "var(--pill-info-bg)" : "var(--card)",
                  color: segment === seg.id ? "var(--pill-info-fg)" : "var(--ink-3)",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {seg.label} ({seg.count})
              </button>
            ))}
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
                        <StatusPill status={o.status} />
                        <div style={{ marginTop: 4, color: "var(--ink-4)", fontSize: 11 }}>
                          {o.progress}%
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
        <OrderDetailsModal
          order={activeOrder}
          savingId={savingId}
          onClose={() => setActiveOrder(null)}
          onChangeStatus={(id, nextStatus) => setPendingStatus({ id, nextStatus })}
        />
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
    <div style={{ ...overlayStyle, zIndex: 200 }} onClick={onCancel}>
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

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    "Order placed": { bg: "var(--pill-info-bg)", color: "var(--pill-info-fg)" },
    Processing: { bg: "var(--pill-warn-bg)", color: "#b45309" },
    "Out for delivery": { bg: "#ede9fe", color: "#6d28d9" },
    Delivered: { bg: "var(--pill-ok-bg)", color: "var(--pill-ok-fg)" },
    Cancelled: { bg: "var(--pill-rose-bg)", color: "var(--pill-rose-fg)" },
  };
  const c = colors[status] || { bg: "var(--chip-2)", color: "var(--ink-2)" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 700,
        background: c.bg,
        color: c.color,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function OrderDetailsModal({
  order,
  savingId,
  onClose,
  onChangeStatus,
}: {
  order: OrderRow;
  savingId: string | null;
  onClose: () => void;
  onChangeStatus: (id: string, nextStatus: string) => void;
}) {
  const items = Array.isArray(order.items) ? order.items : [];
  const isSaving = savingId === order.id;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--ink-4)",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Order
            </div>
            <h3
              style={{ margin: "4px 0 0", fontSize: 22, color: "var(--ink)", letterSpacing: -0.3 }}
            >
              {order.order_code}
            </h3>
          </div>
          <button onClick={onClose} style={{ ...miniBtnStyle, flexShrink: 0 }}>
            ✕ Close
          </button>
        </div>

        {/* Order meta */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <DetailRow label="Placed" value={new Date(order.created_at).toLocaleString()} />
          <DetailRow label="Payment" value={order.payment} />
          <DetailRow label="Subtotal" value={`Rs ${order.subtotal.toLocaleString()}`} />
          <DetailRow label="Shipping" value={`Rs ${order.shipping.toLocaleString()}`} />
          <DetailRow label="Total" value={`Rs ${order.total.toLocaleString()}`} />
          <DetailRow label="Address" value={order.address} />
        </div>

        {/* Items */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>
            Items
          </div>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
            {items.length === 0 ? (
              <div style={{ padding: 12, color: "var(--ink-4)", fontSize: 13 }}>
                No items recorded.
              </div>
            ) : (
              items.map((item: any, idx: number) => (
                <div
                  key={`${item.id || "item"}-${idx}`}
                  style={{
                    padding: "10px 14px",
                    borderTop: idx === 0 ? "none" : "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                    {item.name || item.id || "Item"}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    {item.price != null && (
                      <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>
                        Rs {Number(item.price).toLocaleString()}
                      </span>
                    )}
                    <span style={{ color: "var(--ink-4)" }}>× {item.qty || 1}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Status change */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 10 }}>
            Order Status
          </div>
          {/* Progress bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <StatusPill status={order.status} />
              <span style={{ fontSize: 12, color: "var(--ink-4)", fontWeight: 600 }}>
                {order.progress}% complete
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "var(--line)" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 99,
                  background:
                    order.status === "Cancelled" ? "var(--pill-rose-fg)" : "var(--blue-600)",
                  width: `${order.progress}%`,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
          {/* Status option pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {STATUS_OPTIONS.map((s) => {
              const isActive = s.status === order.status;
              return (
                <button
                  key={s.status}
                  disabled={isActive || isSaving}
                  onClick={() => onChangeStatus(order.id, s.status)}
                  style={{
                    padding: "7px 13px",
                    borderRadius: 99,
                    border: isActive ? "2px solid var(--blue-600)" : "1px solid var(--line)",
                    background: isActive ? "var(--blue-600)" : "var(--card)",
                    color: isActive ? "#fff" : "var(--ink-2)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: isActive || isSaving ? "default" : "pointer",
                    opacity: isSaving && !isActive ? 0.5 : 1,
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  {s.status}
                </button>
              );
            })}
          </div>
          {isSaving && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-4)" }}>Saving…</div>
          )}
        </div>
      </div>
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
  position: "sticky",
  top: 0,
  background: "var(--bg-elev)",
  zIndex: 1,
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
