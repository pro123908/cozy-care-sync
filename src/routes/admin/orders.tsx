import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AdminGate } from "@/wcm/admin-access";
import { useWcm } from "@/wcm/context";
import { WellcareLoader } from "@/wcm/loader";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

type StatusOption = {
  status: string;
  progress: number;
};

const STATUS_OPTIONS: StatusOption[] = [
  { status: "Order placed", progress: 10 },
  { status: "Order confirmed", progress: 25 },
  { status: "Processing", progress: 40 },
  { status: "Out for delivery", progress: 80 },
  { status: "Delivered", progress: 100 },
  { status: "Cancelled", progress: 0 },
];

const PAGE_SIZE = 10;

export const Route = createFileRoute("/admin/orders")({
  validateSearch: (search: Record<string, unknown>) => ({
    orderId: typeof search.orderId === "string" ? search.orderId : undefined,
  }),
  component: AdminOrdersPage,
  head: () => ({
    meta: [{ title: "Admin Orders — Wellcare Mart" }],
  }),
});

function AdminOrdersPage() {
  const { push } = useWcm();
  const navigate = useNavigate();
  const { orderId } = useSearch({ from: "/admin/orders" });
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<"all" | "new" | "active" | "delivered" | "cancelled">(
    "all",
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [updatingBulk, setUpdatingBulk] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingStatus, setPendingStatus] = useState<{
    id: string;
    nextStatus: string;
  } | null>(null);
  const [pendingDeleteOrder, setPendingDeleteOrder] = useState<{
    id: string;
    orderCode: string;
  } | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState<number | null>(null);
  const [pendingBulkStatus, setPendingBulkStatus] = useState<{
    count: number;
    nextStatus: string;
  } | null>(null);

  const loadOrders = async () => {
    const supabase = await getSupabase();
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
        (o.phone || "").toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q);

      const segmentMatch =
        segment === "all"
          ? true
          : segment === "new"
            ? o.status === "Order placed"
            : segment === "active"
              ? ["Order confirmed", "Processing", "Out for delivery"].includes(o.status)
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

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filtered.some((row) => row.id === id)));
  }, [filtered]);

  const selectedCountOnPage = pageRows.filter((row) => selectedIds.includes(row.id)).length;
  const allOnPageSelected = pageRows.length > 0 && selectedCountOnPage === pageRows.length;
  const activeOrder = useMemo(
    () => (orderId ? rows.find((row) => row.id === orderId) || null : null),
    [rows, orderId],
  );

  const clearOrderView = () => {
    navigate({
      to: "/admin/orders",
      search: (prev) => ({ ...prev, orderId: undefined }),
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const togglePageSelection = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageRows.some((row) => row.id === id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...pageRows.map((row) => row.id)])));
  };

  const patchOrder = async (id: string, nextStatus: string) => {
    const selected = STATUS_OPTIONS.find((s) => s.status === nextStatus);
    if (!selected) return;

    setSavingId(id);
    const supabase = await getSupabase();
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

  const deleteOrder = async (id: string) => {
    setSavingId(id);
    const supabase = await getSupabase();
    const { error } = await supabase.from("orders").delete().eq("id", id);
    setSavingId(null);

    if (error) {
      push("Failed to delete order");
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
    if (orderId === id) {
      clearOrderView();
    }
    push("Order deleted");
  };

  const deleteOrders = async (ids: string[]) => {
    if (ids.length === 0) return;

    setDeletingBulk(true);
    const supabase = await getSupabase();
    const { error } = await supabase.from("orders").delete().in("id", ids);
    setDeletingBulk(false);

    if (error) {
      push("Failed to delete selected orders");
      return;
    }

    setRows((prev) => prev.filter((row) => !ids.includes(row.id)));
    setSelectedIds([]);
    if (orderId && ids.includes(orderId)) {
      clearOrderView();
    }
    push(ids.length === 1 ? "Order deleted" : `${ids.length} orders deleted`);
  };

  const patchOrders = async (ids: string[], nextStatus: string) => {
    const selected = STATUS_OPTIONS.find((s) => s.status === nextStatus);
    if (!selected || ids.length === 0) return;

    setUpdatingBulk(true);
    const supabase = await getSupabase();
    const { error } = await supabase
      .from("orders")
      .update({ status: selected.status, progress: selected.progress })
      .in("id", ids);
    setUpdatingBulk(false);

    if (error) {
      push("Failed to update selected orders");
      return;
    }

    setRows((prev) =>
      prev.map((row) =>
        ids.includes(row.id)
          ? {
              ...row,
              status: selected.status,
              progress: selected.progress,
            }
          : row,
      ),
    );
    push(ids.length === 1 ? "Order updated" : `${ids.length} orders updated`);
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

        {orderId && (
          <section style={{ marginTop: 18 }}>
            {loading ? (
              <WellcareLoader label="Loading order details" compact />
            ) : activeOrder ? (
              <OrderDetailsPanel
                order={activeOrder}
                savingId={savingId}
                onBack={clearOrderView}
                onChangeStatus={(id, nextStatus) => setPendingStatus({ id, nextStatus })}
                onDelete={(id, orderCode) => setPendingDeleteOrder({ id, orderCode })}
              />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>
                  Order not found
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-4)" }}>
                  The selected order could not be found. It may have been deleted.
                </div>
                <div>
                  <button onClick={clearOrderView} style={miniBtnStyle}>
                    Back to all orders
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {!orderId && (
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
                  count: rows.filter((r) =>
                    ["Order confirmed", "Processing", "Out for delivery"].includes(r.status),
                  ).length,
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

            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <BulkStatusMenu
                disabled={selectedIds.length === 0 || deletingBulk || updatingBulk}
                busy={updatingBulk}
                options={STATUS_OPTIONS}
                onChoose={(status) =>
                  setPendingBulkStatus({ count: selectedIds.length, nextStatus: status })
                }
              />
              <button
                onClick={() => setPendingBulkDelete(selectedIds.length)}
                disabled={selectedIds.length === 0 || deletingBulk || updatingBulk}
                style={{
                  ...miniDangerBtnStyle,
                  opacity: selectedIds.length && !deletingBulk && !updatingBulk ? 1 : 0.6,
                }}
              >
                {deletingBulk ? "Deleting..." : `Delete selected (${selectedIds.length})`}
              </button>
              {selectedIds.length > 0 && (
                <button onClick={() => setSelectedIds([])} style={miniBtnStyle}>
                  Clear selection
                </button>
              )}
            </div>

            <div style={{ marginTop: 10, color: "var(--ink-4)", fontSize: 12 }}>
              Showing {filtered.length === 0 ? 0 : pageStart + 1}-
              {Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
            </div>

            {loading ? (
              <WellcareLoader label="Loading orders" compact />
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
                      <th style={thStyle}>
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={togglePageSelection}
                        />
                      </th>
                      <th style={thStyle}>Order</th>
                      <th style={thStyle}>User</th>
                      <th style={thStyle}>Phone</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Placed</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((o) => (
                      <tr key={o.id} style={{ borderTop: "1px solid var(--line)" }}>
                        <td style={tdStyle}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(o.id)}
                            onChange={() => toggleSelect(o.id)}
                          />
                        </td>
                        <td style={tdStyle}>{o.order_code}</td>
                        <td style={tdStyle}>{o.user_id.slice(0, 8)}…</td>
                        <td style={tdStyle}>{o.phone || "-"}</td>
                        <td style={tdStyle}>Rs {o.total.toLocaleString()}</td>
                        <td style={tdStyle}>
                          <StatusPill status={o.status} />
                          <div style={{ marginTop: 4, color: "var(--ink-4)", fontSize: 11 }}>
                            {o.progress}%
                          </div>
                        </td>
                        <td style={tdStyle}>{new Date(o.created_at).toLocaleString()}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              onClick={() =>
                                navigate({
                                  to: "/admin/orders",
                                  search: (prev) => ({ ...prev, orderId: o.id }),
                                })
                              }
                              style={miniBtnStyle}
                            >
                              View details
                            </button>
                            <button
                              onClick={() =>
                                setPendingDeleteOrder({ id: o.id, orderCode: o.order_code })
                              }
                              style={miniDangerBtnStyle}
                            >
                              Delete
                            </button>
                          </div>
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
        )}
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

      {pendingDeleteOrder && (
        <ConfirmDialog
          title="Delete order"
          body={`Permanently delete ${pendingDeleteOrder.orderCode}? This removes it from the orders table and cannot be undone.`}
          onCancel={() => setPendingDeleteOrder(null)}
          onConfirm={async () => {
            await deleteOrder(pendingDeleteOrder.id);
            setPendingDeleteOrder(null);
          }}
        />
      )}

      {pendingBulkDelete !== null && (
        <ConfirmDialog
          title="Delete selected orders"
          body={`Permanently delete ${pendingBulkDelete} selected order(s)? This removes them from the orders table and cannot be undone.`}
          onCancel={() => setPendingBulkDelete(null)}
          onConfirm={async () => {
            await deleteOrders(selectedIds);
            setPendingBulkDelete(null);
          }}
        />
      )}

      {pendingBulkStatus && (
        <ConfirmDialog
          title="Update selected orders"
          body={`Change ${pendingBulkStatus.count} selected order(s) to ${pendingBulkStatus.nextStatus}?`}
          onCancel={() => setPendingBulkStatus(null)}
          onConfirm={async () => {
            await patchOrders(selectedIds, pendingBulkStatus.nextStatus);
            setPendingBulkStatus(null);
          }}
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

function BulkStatusMenu({
  disabled,
  busy,
  options,
  onChoose,
}: {
  disabled: boolean;
  busy: boolean;
  options: StatusOption[];
  onChoose: (status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        style={{
          ...miniBtnStyle,
          opacity: disabled ? 0.6 : 1,
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 148,
          justifyContent: "space-between",
        }}
      >
        <span>{busy ? "Updating..." : "Bulk status"}</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && !disabled && (
        <div style={bulkMenuStyle}>
          {options.map((option) => (
            <button
              key={option.status}
              type="button"
              onClick={() => {
                onChoose(option.status);
                setOpen(false);
              }}
              style={bulkMenuItemStyle}
            >
              {option.status}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    "Order placed": { bg: "var(--pill-info-bg)", color: "var(--pill-info-fg)" },
    "Order confirmed": { bg: "var(--pill-ok-bg)", color: "var(--pill-ok-fg)" },
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

function OrderDetailsPanel({
  order,
  savingId,
  onBack,
  onChangeStatus,
  onDelete,
}: {
  order: OrderRow;
  savingId: string | null;
  onBack: () => void;
  onChangeStatus: (id: string, nextStatus: string) => void;
  onDelete: (id: string, orderCode: string) => void;
}) {
  const items = Array.isArray(order.items) ? order.items : [];
  const isSaving = savingId === order.id;
  const { products } = useWcm();
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "none",
        margin: 0,
        background: "transparent",
        border: "none",
        borderRadius: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", gap: 8 }}>
        <button onClick={onBack} style={miniBtnStyle}>
          Back to all orders
        </button>
        <Link to="/admin/orders" style={linkBtnStyle}>
          Orders list
        </Link>
      </div>
      <div style={cardStyle}>
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
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => onDelete(order.id, order.order_code)}
              style={miniDangerBtnStyle}
              disabled={isSaving}
            >
              Delete order
            </button>
          </div>
        </div>

        {/* Order meta */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <DetailRow label="Placed" value={new Date(order.created_at).toLocaleString()} />
          <DetailRow label="Payment" value={order.payment} />
          <DetailRow label="Phone" value={order.phone || "-"} />
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
              items.map((item: any, idx: number) => {
                const prod = productMap.get(item.id);
                const imgUrl = prod?.image_url || item.image_url;
                const productName = prod?.name || item.name || item.id || "Item";
                return (
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
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          overflow: "hidden",
                          flexShrink: 0,
                          background: "var(--bg-elev)",
                          border: "1px solid var(--line)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={item.name || item.id}
                            loading="lazy"
                            decoding="async"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: 16, color: "var(--ink-4)" }}>📦</span>
                        )}
                      </div>
                      {item.id ? (
                        <div style={{ minWidth: 0 }}>
                          <Link
                            to="/products/$productId"
                            params={{ productId: item.id }}
                            style={{
                              color: "var(--ink)",
                              fontWeight: 700,
                              textDecoration: "underline",
                              textUnderlineOffset: 2,
                            }}
                          >
                            {productName}
                          </Link>
                          <div style={{ color: "var(--ink-4)", fontSize: 11, marginTop: 2 }}>
                            {item.id}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--ink)", fontWeight: 600, minWidth: 0 }}>
                          {productName}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      {item.price != null && (
                        <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>
                          Rs {Number(item.price).toLocaleString()}
                        </span>
                      )}
                      <span style={{ color: "var(--ink-4)" }}>× {item.qty || 1}</span>
                    </div>
                  </div>
                );
              })
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

const bulkMenuStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  minWidth: 180,
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 12,
  boxShadow: "var(--shadow-lg)",
  padding: 6,
  zIndex: 50,
};

const bulkMenuItemStyle: CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  color: "var(--ink)",
  textAlign: "left",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 700,
  padding: "8px 10px",
  borderRadius: 8,
  cursor: "pointer",
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
