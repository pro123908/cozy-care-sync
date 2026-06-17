import React, { useState } from "react";
import { PKR, getUnitPrice, type Order, type Product } from "./data";
import { Icons } from "./icons";
import { ProductImage, Pill, Btn, Section, Row } from "./ui";
import { useWcm } from "./context";
import { getSupabase } from "@/integrations/supabase/client";

const STATUSES = [
  "Order placed",
  "Order confirmed",
  "Packed",
  "Shipped",
  "Out for delivery",
  "Delivered",
];

function statusToStep(status: string): number {
  const map: Record<string, number> = {
    "Order placed": 0,
    "Order confirmed": 1,
    Processing: 1,
    Packed: 2,
    Shipped: 3,
    "Out for delivery": 4,
    Delivered: 5,
    Cancelled: -1,
  };
  return map[status] ?? 0;
}

function statusTone(s: string) {
  return s === "Delivered"
    ? "green"
    : s === "Order confirmed"
      ? "green"
      : s === "Out for delivery"
        ? "blue"
        : s === "Cancelled"
          ? "rose"
          : "amber";
}

export function OrdersList({
  orders,
  openOrder,
  goShop,
  ordersLoaded,
}: {
  orders: Order[];
  openOrder: (o: Order) => void;
  goShop: () => void;
  ordersLoaded: boolean;
}) {
  if (!ordersLoaded) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            height: 40,
            width: 220,
            borderRadius: 10,
            background: "var(--chip)",
            animation: "wcmPulse 1.4s ease infinite",
          }}
        />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 160,
              borderRadius: 18,
              background: "var(--chip)",
              animation: "wcmPulse 1.4s ease infinite",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <Section style={{ padding: 64, textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: "var(--grad-soft)",
            color: "var(--blue-700)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          {Icons.pkg}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>No orders yet</div>
        <div style={{ color: "var(--ink-4)", fontSize: 14, marginTop: 4, marginBottom: 18 }}>
          When you place an order, tracking updates and delivery ETA will appear here.
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              borderRadius: 99,
              border: "1px solid var(--line)",
              padding: "6px 10px",
              fontSize: 12,
              color: "var(--ink-3)",
              fontWeight: 700,
            }}
          >
            {Icons.shield} Secure checkout
          </span>
        </div>
        <Btn onClick={goShop} icon={Icons.cart}>
          Shop essentials
        </Btn>
      </Section>
    );
  }
  const { loadOrders, user } = useWcm();
  const [filter, setFilter] = useState<"all" | "active" | "delivered" | "cancelled">("all");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const supabase = await getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) await loadOrders(session.user.id);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === "all") return true;
    if (filter === "active")
      return [
        "Order placed",
        "Order confirmed",
        "Processing",
        "Packed",
        "Shipped",
        "Out for delivery",
      ].includes(o.status);
    if (filter === "delivered") return o.status === "Delivered";
    if (filter === "cancelled") return o.status === "Cancelled";
    return true;
  });

  const filterOptions: { id: typeof filter; label: string }[] = [
    { id: "all", label: `All (${orders.length})` },
    {
      id: "active",
      label: `Active (${orders.filter((o) => ["Order placed", "Processing", "Out for delivery"].includes(o.status)).length})`,
    },
    {
      id: "delivered",
      label: `Delivered (${orders.filter((o) => o.status === "Delivered").length})`,
    },
    {
      id: "cancelled",
      label: `Cancelled (${orders.filter((o) => o.status === "Cancelled").length})`,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        className="wcm-orders-head"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.4 }}>
            Your orders
          </h1>
          <div style={{ color: "var(--ink-4)", fontSize: 13, marginTop: 2 }}>
            {orders.length} orders · all-time
          </div>
        </div>
        <div
          className="wcm-orders-head-actions"
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
        >
          {filterOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${filter === opt.id ? "var(--blue-500)" : "var(--line)"}`,
                background: filter === opt.id ? "var(--pill-info-bg)" : "var(--card)",
                color: filter === opt.id ? "var(--blue-700)" : "var(--ink-3)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
          <Btn variant="outline" icon={Icons.refresh} onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </Btn>
        </div>
      </div>
      {filteredOrders.length === 0 ? (
        <div
          style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-4)", fontSize: 14 }}
        >
          No {filter !== "all" ? filter : ""} orders found.
        </div>
      ) : (
        filteredOrders.map((o) => <OrderCard key={o.id} order={o} onOpen={() => openOrder(o)} />)
      )}
    </div>
  );
}

function OrderCard({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const { products } = useWcm();
  const items = order.items
    .map((it) => ({ ...it, p: products.find((p) => p.id === it.id) as Product }))
    .filter((x) => x.p);
  const totalQty = items.reduce((s, x) => s + x.qty, 0);
  const currentIdx = statusToStep(order.status);
  return (
    <Section style={{ padding: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          className="wcm-order-card-meta"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-4)",
                  fontWeight: 700,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                }}
              >
                Order
              </div>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink)",
                }}
              >
                {order.id}
              </div>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 2 }}>
              Placed {order.placed} · {totalQty} {totalQty === 1 ? "item" : "items"}
            </div>
          </div>
          <div
            className="wcm-order-card-status"
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <Pill tone={statusTone(order.status)}>
              {Icons.dot} {order.status}
            </Pill>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{PKR(order.total)}</div>
          </div>
        </div>

        <div className="wcm-order-card-timeline">
          <div
            className="wcm-order-card-rail"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {STATUSES.map((s, i) => {
              const done = i <= currentIdx;
              return (
                <React.Fragment key={s}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 99,
                      background: done ? "var(--green-500)" : "var(--chip)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {done && (i < currentIdx ? "✓" : "")}
                  </div>
                  {i < STATUSES.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 99,
                        background: i < currentIdx ? "var(--green-500)" : "var(--chip)",
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div
            className="wcm-order-card-labels"
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
              fontSize: 11,
              color: "var(--ink-4)",
              fontWeight: 600,
            }}
          >
            {STATUSES.map((s, i) => (
              <span
                key={s}
                style={{
                  color: i <= currentIdx ? "var(--ink-2)" : "var(--ink-4)",
                  fontWeight: i === currentIdx ? 800 : 600,
                  flex: 1,
                  textAlign: i === 0 ? "left" : i === STATUSES.length - 1 ? "right" : "center",
                }}
              >
                {s}
              </span>
            ))}
          </div>
          <div className="wcm-order-card-mobile-timeline">
            {STATUSES.map((s, i) => {
              const done = i <= currentIdx;
              const current = i === currentIdx;
              return (
                <div
                  key={`mobile-${s}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "22px 1fr",
                    gap: 10,
                    position: "relative",
                    paddingBottom: i === STATUSES.length - 1 ? 0 : 10,
                  }}
                >
                  {i < STATUSES.length - 1 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 10,
                        top: 20,
                        bottom: 0,
                        width: 2,
                        background: i < currentIdx ? "var(--green-500)" : "var(--chip)",
                      }}
                    />
                  )}
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 99,
                      background: done
                        ? current
                          ? "var(--blue-600)"
                          : "var(--green-500)"
                        : "#fff",
                      border: done ? "none" : "2px solid var(--line)",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 800,
                      boxShadow: current ? "0 0 0 4px var(--pill-info-bg)" : "none",
                      zIndex: 1,
                    }}
                  >
                    {done ? (
                      current ? (
                        <span
                          style={{ width: 6, height: 6, borderRadius: 99, background: "#fff" }}
                        />
                      ) : (
                        "✓"
                      )
                    ) : null}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: current ? 800 : 700,
                        color: done ? "var(--ink)" : "var(--ink-4)",
                        lineHeight: 1.2,
                      }}
                    >
                      {s}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }}>
                      {done ? trackingDate(order, i) : "Pending"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="wcm-order-card-footer"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div className="wcm-order-card-items" style={{ display: "flex", alignItems: "center" }}>
            {items.slice(0, 4).map((it, i) => (
              <div
                key={it.id}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 11,
                  overflow: "hidden",
                  marginLeft: i === 0 ? 0 : -10,
                  border: "2px solid var(--card)",
                  background: "var(--card)",
                }}
              >
                <ProductImage product={it.p} />
              </div>
            ))}
            {items.length > 4 && (
              <div
                style={{
                  marginLeft: -10,
                  width: 48,
                  height: 48,
                  borderRadius: 11,
                  border: "2px solid var(--card)",
                  background: "var(--chip)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "var(--ink-3)",
                }}
              >
                +{items.length - 4}
              </div>
            )}
            {items[0] && (
              <div
                className="wcm-order-card-item-name"
                style={{ marginLeft: 14, fontSize: 13, color: "var(--ink-3)" }}
              >
                {items[0].p.name}
                {items.length > 1 ? ` and ${items.length - 1} more` : ""}
              </div>
            )}
          </div>
          <div className="wcm-order-card-actions" style={{ display: "flex", gap: 8 }}>
            {order.status !== "Delivered" && (
              <Btn variant="outline" size="sm" icon={Icons.truck} onClick={onOpen}>
                Track
              </Btn>
            )}
            <Btn variant="primary" size="sm" onClick={onOpen} iconRight={Icons.chev}>
              View details
            </Btn>
          </div>
        </div>
      </div>
    </Section>
  );
}

function trackingDate(order: Order, i: number) {
  if (i === 0) return order.placed + " · 11:24 AM";
  if (i === 1) return order.placed + " · 12:00 PM";
  if (i === 2) return order.placed + " · 03:48 PM";
  if (i === 3) return "In transit · BlueEx courier";
  if (i === 4) return order.eta + " · Today by 4 PM";
  if (i === 5) return order.eta + " · 02:18 PM";
  return "";
}

export function OrderDetail({
  order,
  onClose,
  onCancel,
}: {
  order: Order;
  onClose: () => void;
  onCancel?: () => Promise<void>;
}) {
  const { addToCart, products, submitOrderReview, push } = useWcm();
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [activeReviewProductId, setActiveReviewProductId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const handleReorder = () => {
    items.forEach(({ p, qty, size }) => addToCart(p, qty, size));
  };

  const handleCancel = async () => {
    if (!onCancel) return;
    setCancelling(true);
    await onCancel();
    setCancelling(false);
    setShowCancelConfirm(false);
  };

  const handleSubmitReview = async (productId: string) => {
    if (reviewRating === 0) return;
    setSubmittingReview(true);
    try {
      await submitOrderReview(order.id, productId, reviewRating, reviewComment.trim());
      push("Thanks for your review!", { tone: "green" });
      setActiveReviewProductId(null);
      setReviewRating(0);
      setReviewHover(0);
      setReviewComment("");
    } catch {
      push("Couldn't submit review. Please try again.", { tone: "rose" });
    } finally {
      setSubmittingReview(false);
    }
  };

  const items = order.items
    .map((it) => ({ ...it, p: products.find((p) => p.id === it.id) as Product }))
    .filter((x) => x.p);
  const productReviews = order.product_reviews || {};
  const hasPendingProductReviews =
    order.status === "Delivered" && items.some(({ p }) => !productReviews[p.id]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "var(--ink-3)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          padding: 0,
        }}
      >
        {Icons.chevL} Back to orders
      </button>

      <div
        className="wcm-order-detail-head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--ink-4)",
              fontSize: 13,
            }}
          >
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 700,
                color: "var(--ink-2)",
              }}
            >
              {order.id}
            </span>
            <span>·</span>
            <span>Placed {order.placed}</span>
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: -0.4 }}>
            {order.status === "Delivered"
              ? "Delivered on " + order.eta
              : order.status === "Cancelled"
                ? "Order cancelled"
                : "Arriving by " + order.eta}
          </h1>
        </div>
        <div className="wcm-order-detail-status-pill">
          <Pill tone={statusTone(order.status)}>
            {Icons.dot} {order.status}
          </Pill>
        </div>
      </div>

      <div className="wcm-order-cols" style={{ display: "grid", gap: 14 }}>
        <Section style={{ padding: 22 }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--ink-4)",
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Tracking timeline
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {STATUSES.map((s, i) => {
              const done = i <= statusToStep(order.status);
              const current = i === statusToStep(order.status);
              return (
                <div
                  key={s}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "32px 1fr",
                    gap: 14,
                    position: "relative",
                    paddingBottom: i === STATUSES.length - 1 ? 0 : 18,
                  }}
                >
                  {i < STATUSES.length - 1 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 15,
                        top: 30,
                        bottom: 0,
                        width: 2,
                        background:
                          i < statusToStep(order.status) ? "var(--green-500)" : "var(--chip)",
                      }}
                    />
                  )}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 99,
                      background: done
                        ? current
                          ? "var(--blue-600)"
                          : "var(--green-500)"
                        : "#fff",
                      border: done ? "none" : "2px solid var(--line)",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: current ? "0 0 0 4px var(--pill-info-bg)" : "none",
                      transition: "all .2s",
                      zIndex: 1,
                    }}
                  >
                    {done ? (
                      current ? (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 99,
                            background: "var(--card)",
                          }}
                        />
                      ) : (
                        Icons.check
                      )
                    ) : null}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: done ? "var(--ink)" : "var(--ink-4)",
                      }}
                    >
                      {s}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>
                      {done ? trackingDate(order, i) : "Pending"}
                    </div>
                    {current && order.rider && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "10px 12px",
                          borderRadius: 11,
                          background: "var(--blue-50)",
                          border: "1px solid #dbeafe",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 99,
                            background: "var(--blue-600)",
                            color: "#fff",
                            fontWeight: 800,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                          }}
                        >
                          {order.rider.name
                            .split(" ")
                            .map((x) => x[0])
                            .join("")}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{order.rider.name}</div>
                          <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                            Your rider · {order.rider.phone}
                          </div>
                        </div>
                        <Btn variant="outline" size="sm" icon={Icons.phone}>
                          Call
                        </Btn>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Section style={{ padding: 18 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-4)",
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Delivery address
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: "var(--green-50)",
                  color: "var(--green-700)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {Icons.pin}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
                {order.address}
              </div>
            </div>
          </Section>
          <Section style={{ padding: 18 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-4)",
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Payment
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: "var(--grad-soft)",
                  color: "var(--blue-700)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {order.payment.startsWith("Card") ? Icons.card : Icons.cash}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{order.payment}</div>
            </div>
            {order.payment.toLowerCase() === "bank transfer" && (
              <div style={{ marginTop: 14 }}>
                {order.status === "Order placed" ? (
                  <>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--ink-4)",
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      Transfer to
                    </div>
                    <Section style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[
                          ["Bank", "MCB Islamic Bank"],
                          ["Account title", "DROXLABS LLP"],
                          ["Account no.", "2691006549640001"],
                          ["Branch", "Electronic Market Branch"],
                          ["Branch code", "269"],
                          ["IBAN", "PK92MCIB2691006549640001"],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              gap: 12,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                color: "var(--ink-4)",
                                fontWeight: 600,
                                flexShrink: 0,
                              }}
                            >
                              {label}
                            </span>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                fontFamily:
                                  label === "Account no." || label === "IBAN"
                                    ? "monospace"
                                    : "inherit",
                                textAlign: "right",
                              }}
                            >
                              {value}
                            </span>
                          </div>
                        ))}
                        <div style={{ height: 1, background: "var(--line)" }} />
                        <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>
                          Use order code{" "}
                          <span
                            style={{
                              fontWeight: 800,
                              fontFamily: "monospace",
                              background: "var(--chip)",
                              padding: "1px 6px",
                              borderRadius: 5,
                            }}
                          >
                            {order.id}
                          </span>{" "}
                          as the transfer reference.
                        </div>
                        <a
                          href={`https://wa.me/923291557509?text=${encodeURIComponent(`Hi, I'm sending the payment receipt for order ${order.id}.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            padding: "10px 16px",
                            borderRadius: 10,
                            background: "#25D366",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: 13,
                            textDecoration: "none",
                          }}
                        >
                          <svg
                            width="17"
                            height="17"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            style={{ flexShrink: 0 }}
                          >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          Send receipt on WhatsApp
                        </a>
                      </div>
                    </Section>
                  </>
                ) : (
                  <div
                    style={{
                      marginTop: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "var(--pill-ok-bg)",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--pill-ok-fg)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0 }}
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pill-ok-fg)" }}>
                        Payment received
                      </div>
                      <div style={{ fontSize: 12, color: "var(--pill-ok-fg)", opacity: 0.8 }}>
                        Your bank transfer has been confirmed.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>
          <Section style={{ padding: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Row label="Subtotal" value={PKR(order.subtotal)} />
              <Row
                label="Delivery"
                value={
                  order.shipping === 0 ? (
                    <span style={{ color: "var(--pill-success-fg)", fontWeight: 700 }}>Free</span>
                  ) : (
                    PKR(order.shipping)
                  )
                }
              />
              <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
              <Row
                label={<span style={{ fontSize: 14, fontWeight: 800 }}>Total paid</span>}
                value={<span style={{ fontSize: 18, fontWeight: 800 }}>{PKR(order.total)}</span>}
              />
            </div>
          </Section>
        </div>
      </div>

      <Section style={{ padding: 18 }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--ink-4)",
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Items in this order
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map(({ p, qty, size, unit_price }, i) => {
            const review = productReviews[p.id];
            const isEditing = activeReviewProductId === p.id;

            return (
              <React.Fragment key={p.id}>
                <div
                  className="wcm-order-detail-item-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "56px 1fr auto auto",
                    gap: 14,
                    alignItems: "center",
                    padding: "12px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--line-2)",
                  }}
                >
                  <div
                    className="wcm-order-detail-item-image"
                    style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden" }}
                  >
                    <ProductImage product={p} />
                  </div>
                  <div className="wcm-order-detail-item-info">
                    <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 700 }}>
                      {p.brand}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{p.name}</div>
                    {order.status === "Delivered" && (
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
                        {review ? (
                          <>
                            <span style={{ display: "inline-flex", gap: 1 }}>
                              {[1, 2, 3, 4, 5].map((s) => (
                                <svg
                                  key={s}
                                  width={14}
                                  height={14}
                                  viewBox="0 0 24 24"
                                  fill={s <= review.rating ? "#f59e0b" : "var(--line)"}
                                >
                                  <polygon points="12,3 14.7,9 21,9.7 16.2,14 17.6,20.5 12,17.3 6.4,20.5 7.8,14 3,9.7 9.3,9" />
                                </svg>
                              ))}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--ink-4)", fontWeight: 600 }}>
                              Rated
                            </span>
                          </>
                        ) : isEditing && activeReviewProductId === p.id ? (
                          <div
                            style={{
                              display: "flex",
                              gap: 4,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                              {[1, 2, 3, 4, 5].map((s) => (
                                <button
                                  key={s}
                                  onMouseEnter={() => setReviewHover(s)}
                                  onMouseLeave={() => setReviewHover(0)}
                                  onClick={() => setReviewRating(s)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                    lineHeight: 1,
                                    transition: "transform .1s",
                                    transform:
                                      s <= (reviewHover || reviewRating)
                                        ? "scale(1.1)"
                                        : "scale(1)",
                                  }}
                                >
                                  <svg
                                    width={18}
                                    height={18}
                                    viewBox="0 0 24 24"
                                    fill={
                                      s <= (reviewHover || reviewRating) ? "#f59e0b" : "var(--line)"
                                    }
                                  >
                                    <polygon points="12,3 14.7,9 21,9.7 16.2,14 17.6,20.5 12,17.3 6.4,20.5 7.8,14 3,9.7 9.3,9" />
                                  </svg>
                                </button>
                              ))}
                            </div>
                            {reviewRating > 0 && (
                              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                                {["", "Poor", "Fair", "Good", "Great", "Excellent"][reviewRating]}
                              </span>
                            )}
                            <div style={{ display: "flex", gap: 3 }}>
                              <button
                                onClick={() => {
                                  setActiveReviewProductId(null);
                                  setReviewRating(0);
                                  setReviewHover(0);
                                  setReviewComment("");
                                }}
                                style={{
                                  background: "none",
                                  border: "1px solid var(--line)",
                                  cursor: "pointer",
                                  padding: "2px 5px",
                                  borderRadius: 4,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  transition: "all .15s",
                                  color: "var(--ink-3)",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "var(--line)";
                                  e.currentTarget.style.color = "var(--ink)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "none";
                                  e.currentTarget.style.color = "var(--ink-3)";
                                }}
                              >
                                <svg
                                  width={12}
                                  height={12}
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                >
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleSubmitReview(p.id)}
                                disabled={reviewRating === 0 || submittingReview}
                                style={{
                                  background: "none",
                                  border: "1px solid var(--line)",
                                  cursor:
                                    reviewRating === 0 || submittingReview
                                      ? "not-allowed"
                                      : "pointer",
                                  padding: "2px 5px",
                                  borderRadius: 4,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  transition: "all .15s",
                                  color:
                                    reviewRating === 0 || submittingReview
                                      ? "var(--ink-5)"
                                      : "var(--ink-3)",
                                  opacity: reviewRating === 0 || submittingReview ? 0.5 : 1,
                                }}
                                onMouseEnter={(e) => {
                                  if (reviewRating > 0 && !submittingReview) {
                                    e.currentTarget.style.background = "var(--line)";
                                    e.currentTarget.style.color = "var(--ink)";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "none";
                                  e.currentTarget.style.color =
                                    reviewRating === 0 || submittingReview
                                      ? "var(--ink-5)"
                                      : "var(--ink-3)";
                                }}
                              >
                                {submittingReview ? (
                                  <svg
                                    width={12}
                                    height={12}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                    style={{ animation: "spin .8s linear infinite" }}
                                  >
                                    <circle cx={12} cy={12} r={10} />
                                    <path d="M12 2a10 10 0 0 1 10 10" />
                                  </svg>
                                ) : (
                                  <svg
                                    width={12}
                                    height={12}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setActiveReviewProductId(p.id);
                              setReviewRating(0);
                              setReviewHover(0);
                              setReviewComment("");
                            }}
                            style={{
                              border: "1px solid var(--line)",
                              background: "var(--card)",
                              color: "var(--ink-3)",
                              borderRadius: 999,
                              padding: "4px 10px",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Rate this product
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    className="wcm-order-detail-item-qty"
                    style={{ fontSize: 13, color: "var(--ink-4)", fontWeight: 600 }}
                  >
                    Qty {qty}
                    {size ? (
                      <div style={{ marginTop: 2, fontSize: 11 }}>Selection {size}</div>
                    ) : null}
                  </div>
                  <div
                    className="wcm-order-detail-item-price"
                    style={{ fontSize: 14, fontWeight: 800 }}
                  >
                    {PKR((unit_price ?? getUnitPrice(p, size)) * qty)}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <div
          className="wcm-order-detail-actions"
          style={{
            display: "flex",
            gap: 10,
            marginTop: 14,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <Btn variant="outline" icon={Icons.refresh} onClick={handleReorder}>
            Reorder
          </Btn>
          {hasPendingProductReviews && (
            <Btn
              variant="outline"
              icon={Icons.heart}
              onClick={() => {
                if (activeReviewProductId) {
                  setActiveReviewProductId(null);
                  setReviewRating(0);
                  setReviewHover(0);
                  setReviewComment("");
                  return;
                }
                const firstUnrated = items.find(({ p }) => !productReviews[p.id]);
                if (!firstUnrated) return;
                setActiveReviewProductId(firstUnrated.p.id);
                setReviewRating(0);
                setReviewHover(0);
                setReviewComment("");
              }}
            >
              {activeReviewProductId ? "Close rating" : "Rate products"}
            </Btn>
          )}
          {order.status !== "Delivered" &&
            order.status !== "Cancelled" &&
            (showCancelConfirm ? (
              <div
                className="wcm-order-detail-cancel-confirm"
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Cancel this order?</span>
                <Btn variant="danger" onClick={handleCancel} disabled={cancelling}>
                  {cancelling ? "Cancelling…" : "Yes, cancel"}
                </Btn>
                <Btn variant="outline" onClick={() => setShowCancelConfirm(false)}>
                  No
                </Btn>
              </div>
            ) : (
              <Btn variant="danger" onClick={() => setShowCancelConfirm(true)}>
                Cancel order
              </Btn>
            ))}
          <Btn icon={Icons.phone}>Contact support</Btn>
        </div>
      </Section>
    </div>
  );
}

export function OrderSuccess({
  order,
  onClose,
  onView,
}: {
  order: Order;
  onClose: () => void;
  onView: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--overlay)",
        zIndex: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "var(--card)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 480,
          padding: 32,
          animation: "popIn .35s cubic-bezier(.2,.7,.2,1.2) both",
          textAlign: "center",
        }}
      >
        <style>{`@keyframes popIn{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 99,
            background: "var(--grad)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 12px",
            boxShadow: "0 16px 32px -8px rgba(22,163,74,.4)",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 12 4 4 10-10" />
          </svg>
        </div>
        <h2 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, letterSpacing: -0.4 }}>
          Order placed!
        </h2>
        <p style={{ margin: 0, color: "var(--ink-4)", fontSize: 14 }}>
          Thanks for shopping with Wellcare Mart. We've sent a confirmation to your email.
        </p>
        <div
          style={{
            marginTop: 18,
            padding: "12px 16px",
            background: "var(--grad-soft)",
            borderRadius: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-4)",
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              Order ID
            </div>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 800, fontSize: 15 }}>
              {order.id}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-4)",
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              Total
            </div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{PKR(order.total)}</div>
          </div>
        </div>
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 11,
            background: "var(--soft-green)",
            color: "var(--pill-success-fg)",
            fontSize: 13,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {Icons.truck} Estimated delivery {order.eta}
        </div>
        <div className="wcm-success-actions" style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <Btn full variant="outline" onClick={onClose}>
            Continue shopping
          </Btn>
          <Btn full onClick={onView} iconRight={Icons.chev}>
            Track order
          </Btn>
        </div>
      </div>
    </div>
  );
}
