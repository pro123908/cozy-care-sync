import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AdminGate } from "@/wcm/admin-access";
import { useWcm } from "@/wcm/context";
import { getProductSeoPathSegment } from "@/wcm/data";
import { WellcareLoader } from "@/wcm/loader";
import { useIsMobile } from "@/hooks/use-mobile";
import { NOINDEX_FOLLOW_META, canonicalUrl } from "@/lib/seo";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderReviewRow = Database["public"]["Tables"]["order_reviews"]["Row"];

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
    links: [{ rel: "canonical", href: canonicalUrl("/admin/orders") }],
    meta: [{ title: "Admin Orders — Wellcare Mart" }, NOINDEX_FOLLOW_META],
  }),
});

function AdminOrdersPage() {
  const { push } = useWcm();
  const isMobile = useIsMobile();
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
        (o.customer_name || "").toLowerCase().includes(q) ||
        (o.email || "").toLowerCase().includes(q) ||
        (o.landmark || "").toLowerCase().includes(q) ||
        (o.user_id || "").toLowerCase().includes(q) ||
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
    setSelectedIds((prev: string[]) => prev.filter((id) => filtered.some((row) => row.id === id)));
  }, [filtered]);

  const selectedCountOnPage = pageRows.filter((row) => selectedIds.includes(row.id)).length;
  const allOnPageSelected = pageRows.length > 0 && selectedCountOnPage === pageRows.length;
  const activeOrder = useMemo(
    () => (orderId ? rows.find((row) => row.id === orderId) || null : null),
    [rows, orderId],
  );

  const clearOrderView = () => {
    window.location.assign("/admin/orders");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev: string[]) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const togglePageSelection = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev: string[]) =>
        prev.filter((id) => !pageRows.some((row) => row.id === id)),
      );
      return;
    }
    setSelectedIds((prev: string[]) =>
      Array.from(new Set([...prev, ...pageRows.map((row) => row.id)])),
    );
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

    setRows((prev: OrderRow[]) =>
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

    setRows((prev: OrderRow[]) => prev.filter((r) => r.id !== id));
    setSelectedIds((prev: string[]) => prev.filter((selectedId) => selectedId !== id));
    if (orderId === id) {
      clearOrderView();
    }

    const { error: recalcError } = await supabase.rpc("recalculate_product_sales_counts");
    if (recalcError) {
      push("Order deleted, but sales analytics sync failed.");
      return;
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

    setRows((prev: OrderRow[]) => prev.filter((row) => !ids.includes(row.id)));
    setSelectedIds([]);
    if (orderId && ids.includes(orderId)) {
      clearOrderView();
    }

    const { error: recalcError } = await supabase.rpc("recalculate_product_sales_counts");
    if (recalcError) {
      push("Orders deleted, but sales analytics sync failed.");
      return;
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

    setRows((prev: OrderRow[]) =>
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
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: isMobile ? "0" : "30px 20px 90px" }}>
        <div
          style={{
            display: "flex",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, letterSpacing: -0.4, color: "var(--ink)" }}>
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
                alignItems: isMobile ? "stretch" : "center",
                flexDirection: isMobile ? "column" : "row",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <h2 style={sectionTitleStyle}>All orders</h2>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by order code, name, email, phone"
                style={{ ...searchInputStyle, width: isMobile ? "100%" : 280, boxSizing: "border-box" }}
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
            ) : isMobile ? (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {pageRows.length === 0 ? (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                    No orders found.
                  </div>
                ) : pageRows.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: 14,
                      background: statusRowAccent(o.status).background,
                      borderLeft: statusRowAccent(o.status).borderLeft,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(o.id)}
                          onChange={() => toggleSelect(o.id)}
                        />
                        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>{o.order_code}</span>
                      </div>
                      <StatusPill status={o.status} />
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 3 }}>
                      {o.customer_name || (o.user_id ? `${o.user_id.slice(0, 8)}…` : "Guest")}
                      {o.phone ? ` · ${o.phone}` : ""}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>
                      Rs {o.total.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)", marginBottom: 10 }}>
                      {new Date(o.created_at).toLocaleString()}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => window.location.assign(`/admin/orders?orderId=${encodeURIComponent(o.id)}`)}
                        style={miniBtnStyle}
                      >
                        View details
                      </button>
                      <button
                        onClick={() => setPendingDeleteOrder({ id: o.id, orderCode: o.order_code })}
                        style={miniDangerBtnStyle}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
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
                      <th style={thStyle}>
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={togglePageSelection}
                        />
                      </th>
                      <th style={thStyle}>Order</th>
                      <th style={thStyle}>Customer</th>
                      <th style={thStyle}>Phone</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Placed</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((o) => (
                      <tr key={o.id} style={{ borderTop: "1px solid var(--line)", background: statusRowAccent(o.status).background }}>
                        <td style={{ ...tdStyle, borderLeft: statusRowAccent(o.status).borderLeft }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(o.id)}
                            onChange={() => toggleSelect(o.id)}
                          />
                        </td>
                        <td style={tdStyle}>{o.order_code}</td>
                        <td style={tdStyle}>
                          {o.customer_name || (o.user_id ? `${o.user_id.slice(0, 8)}…` : "Guest")}
                        </td>
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
                                window.location.assign(
                                  `/admin/orders?orderId=${encodeURIComponent(o.id)}`,
                                )
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

function statusRowAccent(status: string): { background: string; borderLeft: string } {
  const map: Record<string, { background: string; borderLeft: string }> = {
    "Order placed":     { background: "rgba(59,130,246,0.05)",  borderLeft: "3px solid #3b82f6" },
    "Order confirmed":  { background: "rgba(16,185,129,0.05)",  borderLeft: "3px solid #10b981" },
    Processing:         { background: "rgba(245,158,11,0.06)",  borderLeft: "3px solid #d97706" },
    "Out for delivery": { background: "rgba(109,40,217,0.05)",  borderLeft: "3px solid #7c3aed" },
    Delivered:          { background: "rgba(16,185,129,0.08)",  borderLeft: "3px solid #10b981" },
    Cancelled:          { background: "rgba(244,63,94,0.05)",   borderLeft: "3px solid #f43f5e" },
  };
  return map[status] ?? { background: "transparent", borderLeft: "3px solid transparent" };
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
  const isMobile = useIsMobile();
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [reviews, setReviews] = useState<OrderReviewRow[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setReviewsLoading(true);
    (async () => {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("order_reviews")
        .select("*")
        .eq("order_code", order.order_code);
      if (cancelled) return;
      if (!error && data) setReviews(data);
      setReviewsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [order.order_code]);

  const reviewsByProduct = useMemo(() => {
    const map = new Map<string, OrderReviewRow>();
    for (const r of reviews) map.set(r.product_id, r);
    return map;
  }, [reviews]);

  const accent = statusRowAccent(order.status);

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Back nav */}
        <button
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--ink-4)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ← All orders
        </button>

        {/* Hero card */}
        <div
          style={{
            ...cardStyle,
            borderLeft: accent.borderLeft,
            background: accent.background,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Order
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: -0.4 }}>
                {order.order_code}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 4 }}>
                {new Date(order.created_at).toLocaleString()}
              </div>
            </div>
            <StatusPill status={order.status} />
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ height: 6, borderRadius: 99, background: "rgba(0,0,0,0.08)" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 99,
                  background: order.status === "Cancelled" ? "#f43f5e" : "#3b82f6",
                  width: `${order.progress}%`,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 5, fontWeight: 600 }}>
              {order.progress}% complete
            </div>
          </div>

          {/* Total + payment */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 0.5 }}>Total</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--ink)", letterSpacing: -0.5, marginTop: 2 }}>
                Rs {order.total.toLocaleString()}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 0.5 }}>Payment</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{order.payment}</div>
            </div>
          </div>
        </div>

        {/* Customer */}
        <div style={cardStyle}>
          <div style={mobileSectionLabel}>Customer</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <MobileInfoRow label="Name" value={order.customer_name || "-"} />
            <MobileInfoRow label="Email" value={order.email || "-"} />
            <MobileInfoRow label="Phone" value={order.phone || "-"} />
          </div>
        </div>

        {/* Delivery */}
        <div style={cardStyle}>
          <div style={mobileSectionLabel}>Delivery</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <MobileInfoRow label="Address" value={order.address} />
            <MobileInfoRow label="Landmark" value={order.landmark || "-"} />
          </div>
        </div>

        {/* Items */}
        <div style={cardStyle}>
          <div style={mobileSectionLabel}>Items ({items.length})</div>
          {items.length === 0 ? (
            <div style={{ color: "var(--ink-4)", fontSize: 13 }}>No items recorded.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {items.map((item: any, idx: number) => {
                const prod = productMap.get(item.id);
                const imgUrl = prod?.image_url || item.image_url;
                const productName = prod?.name || item.name || item.id || "Item";
                const productRouteParam = prod ? getProductSeoPathSegment(prod, products) : item.id;
                const itemQty = Number(item.qty) || 1;
                const unitPrice =
                  item.unit_price != null ? Number(item.unit_price)
                  : item.price != null ? Number(item.price)
                  : null;
                return (
                  <div
                    key={`${item.id || "item"}-${idx}`}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      paddingTop: idx === 0 ? 0 : 12,
                      borderTop: idx === 0 ? "none" : "1px solid var(--line)",
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 10,
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
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <span style={{ fontSize: 20 }}>📦</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {item.id ? (
                        <Link
                          to="/products/$productId"
                          params={{ productId: productRouteParam }}
                          style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 2 }}
                        >
                          {productName}
                        </Link>
                      ) : (
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{productName}</div>
                      )}
                      {item.size && (
                        <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>
                          Size: <span style={{ fontWeight: 700, color: "var(--ink-3)" }}>{item.size}</span>
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 4 }}>
                        {unitPrice != null
                          ? `Rs ${unitPrice.toLocaleString()} × ${itemQty} = Rs ${(unitPrice * itemQty).toLocaleString()}`
                          : `× ${itemQty}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reviews */}
        <div style={cardStyle}>
          <div style={mobileSectionLabel}>Customer reviews</div>
          <ReviewsSection
            items={items as OrderItemLike[]}
            reviewsByProduct={reviewsByProduct}
            reviewsLoading={reviewsLoading}
            productMap={productMap}
          />
        </div>

        {/* Payment summary */}
        <div style={cardStyle}>
          <div style={mobileSectionLabel}>Payment summary</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--ink-4)" }}>Subtotal</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Rs {order.subtotal.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--ink-4)" }}>Shipping</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Rs {order.shipping.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--line)" }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>Total</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: "var(--ink)" }}>Rs {order.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Update status */}
        <div style={cardStyle}>
          <div style={mobileSectionLabel}>Update status</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {STATUS_OPTIONS.map((s) => {
              const isActive = s.status === order.status;
              return (
                <button
                  key={s.status}
                  disabled={isActive || isSaving}
                  onClick={() => onChangeStatus(order.id, s.status)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: isActive ? "2px solid #3b82f6" : "1px solid var(--line)",
                    background: isActive ? "#3b82f6" : "var(--card)",
                    color: isActive ? "#fff" : "var(--ink)",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: isActive || isSaving ? "default" : "pointer",
                    opacity: isSaving && !isActive ? 0.5 : 1,
                    fontFamily: "inherit",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "all 0.15s",
                  }}
                >
                  <span>{s.status}</span>
                  {isActive && <span style={{ fontSize: 12, opacity: 0.8 }}>Current</span>}
                </button>
              );
            })}
          </div>
          {isSaving && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-4)" }}>Saving…</div>
          )}
        </div>

        {/* Danger zone */}
        <div
          style={{
            ...cardStyle,
            border: "1px solid rgba(244,63,94,0.3)",
            background: "rgba(244,63,94,0.03)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: "#f43f5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
            Danger zone
          </div>
          <button
            onClick={() => onDelete(order.id, order.order_code)}
            disabled={isSaving}
            style={{
              width: "100%",
              padding: "13px 16px",
              borderRadius: 12,
              border: "1px solid #f43f5e",
              background: "transparent",
              color: "#f43f5e",
              fontSize: 14,
              fontWeight: 700,
              cursor: isSaving ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            Delete this order
          </button>
        </div>

      </div>
    );
  }

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
          <DetailRow label="Customer" value={order.customer_name || "-"} />
          <DetailRow label="Email" value={order.email || "-"} />
          <DetailRow label="Phone" value={order.phone || "-"} />
          <DetailRow label="Subtotal" value={`Rs ${order.subtotal.toLocaleString()}`} />
          <DetailRow label="Shipping" value={`Rs ${order.shipping.toLocaleString()}`} />
          <DetailRow label="Total" value={`Rs ${order.total.toLocaleString()}`} />
          <DetailRow label="Address" value={order.address} />
          <DetailRow label="Landmark" value={order.landmark || "-"} />
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
                const productRouteParam = prod ? getProductSeoPathSegment(prod, products) : item.id;
                const itemQty = Number(item.qty) || 1;
                const unitPrice =
                  item.unit_price != null
                    ? Number(item.unit_price)
                    : item.price != null
                      ? Number(item.price)
                      : null;
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
                            params={{ productId: productRouteParam }}
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
                          {item.size ? (
                            <div style={{ color: "var(--ink-4)", fontSize: 11, marginTop: 2 }}>
                              Selection:{" "}
                              <span style={{ fontWeight: 700, color: "var(--ink-3)" }}>
                                {item.size}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span style={{ color: "var(--ink)", fontWeight: 600, minWidth: 0 }}>
                          {productName}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      {unitPrice != null && (
                        <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>
                          Rs {unitPrice.toLocaleString()}
                        </span>
                      )}
                      <span style={{ color: "var(--ink-4)" }}>× {itemQty}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Reviews */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>
            Customer reviews
          </div>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 14 }}>
            <ReviewsSection
              items={items as OrderItemLike[]}
              reviewsByProduct={reviewsByProduct}
              reviewsLoading={reviewsLoading}
              productMap={productMap}
            />
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

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ color: "#f59e0b", fontSize: 13, letterSpacing: 1 }}>
      {"★".repeat(Math.max(0, Math.min(5, rating)))}
      <span style={{ color: "var(--line)" }}>{"★".repeat(5 - Math.max(0, Math.min(5, rating)))}</span>
    </span>
  );
}

type OrderItemLike = { id: string; qty: number; size?: string; name?: string };

function ReviewsSection({
  items,
  reviewsByProduct,
  reviewsLoading,
  productMap,
}: {
  items: OrderItemLike[];
  reviewsByProduct: Map<string, OrderReviewRow>;
  reviewsLoading: boolean;
  productMap: Map<string, ReturnType<typeof useWcm>["products"][number]>;
}) {
  const reviewedItems = items
    .map((item) => ({ item, review: reviewsByProduct.get(item.id) }))
    .filter((entry) => entry.review);

  if (reviewsLoading) {
    return <div style={{ color: "var(--ink-4)", fontSize: 13 }}>Loading reviews…</div>;
  }

  if (reviewedItems.length === 0) {
    return <div style={{ color: "var(--ink-4)", fontSize: 13 }}>No reviews submitted for this order.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {reviewedItems.map(({ item, review }, idx) => {
        const prod = productMap.get(item.id);
        const productName = prod?.name || item.name || item.id || "Item";
        return (
          <div
            key={review!.id}
            style={{
              paddingTop: idx === 0 ? 0 : 12,
              borderTop: idx === 0 ? "none" : "1px solid var(--line)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{productName}</span>
              <StarRating rating={review!.rating} />
            </div>
            {review!.comment && (
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
                {review!.comment}
              </div>
            )}
          </div>
        );
      })}
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

function MobileInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <span style={{ fontSize: 13, color: "var(--ink-4)", fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}

const mobileSectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "var(--ink-4)",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  marginBottom: 14,
};

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
