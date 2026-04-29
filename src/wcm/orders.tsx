import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PKR, type Order, type Product } from "./data";
import { Icons } from "./icons";
import { ProductImage, Pill, Btn, Section, Row } from "./ui";
import { useWcm } from "./context";

const STATUSES = ["Order placed", "Packed", "Shipped", "Out for delivery", "Delivered"];

function statusToStep(status: string): number {
  const map: Record<string, number> = {
    "Order placed": 0,
    Processing: 1,
    Packed: 1,
    Shipped: 2,
    "Out for delivery": 3,
    Delivered: 4,
    Cancelled: -1,
  };
  return map[status] ?? 0;
}

function statusTone(s: string) {
  return s === "Delivered"
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
          When you place an order, you'll see it here.
        </div>
        <Btn onClick={goShop} icon={Icons.cart}>
          Start shopping
        </Btn>
      </Section>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.4 }}>
            Your orders
          </h1>
          <div style={{ color: "var(--ink-4)", fontSize: 13, marginTop: 2 }}>
            {orders.length} orders · all-time
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="outline" icon={Icons.filter}>
            Filter
          </Btn>
          <Btn variant="outline" icon={Icons.refresh}>
            Refresh
          </Btn>
        </div>
      </div>
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} onOpen={() => openOrder(o)} />
      ))}
    </div>
  );
}

function OrderCard({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const { products } = useWcm();
  const items = order.items
    .map((it) => ({ ...it, p: products.find((p) => p.id === it.id) as Product }))
    .filter((x) => x.p);
  const totalQty = items.reduce((s, x) => s + x.qty, 0);
  return (
    <Section style={{ padding: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Pill tone={statusTone(order.status)}>
              {Icons.dot} {order.status}
            </Pill>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{PKR(order.total)}</div>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {STATUSES.map((s, i) => {
              const currentIdx = statusToStep(order.status);
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
                  color: i <= statusToStep(order.status) ? "var(--ink-2)" : "var(--ink-4)",
                  fontWeight: i === statusToStep(order.status) ? 800 : 600,
                  flex: 1,
                  textAlign: i === 0 ? "left" : i === STATUSES.length - 1 ? "right" : "center",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
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
              <div style={{ marginLeft: 14, fontSize: 13, color: "var(--ink-3)" }}>
                {items[0].p.name}
                {items.length > 1 ? ` and ${items.length - 1} more` : ""}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {order.status !== "Delivered" && (
              <Btn variant="outline" size="sm" icon={Icons.truck}>
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
  if (i === 1) return order.placed + " · 03:48 PM";
  if (i === 2) return "In transit · TCS courier";
  if (i === 3) return order.eta + " · Today by 4 PM";
  if (i === 4) return order.eta + " · 02:18 PM";
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
  const { addToCart, products } = useWcm();
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleReorder = () => {
    items.forEach(({ p, qty }) => addToCart(p, qty));
  };

  const handleCancel = async () => {
    if (!onCancel) return;
    setCancelling(true);
    await onCancel();
    setCancelling(false);
    setShowCancelConfirm(false);
  };

  const items = order.items
    .map((it) => ({ ...it, p: products.find((p) => p.id === it.id) as Product }))
    .filter((x) => x.p);
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
        <Pill tone={statusTone(order.status)}>
          {Icons.dot} {order.status}
        </Pill>
      </div>

      <div
        className="wcm-order-cols"
        style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}
      >
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
          {items.map(({ p, qty }, i) => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr auto auto",
                gap: 14,
                alignItems: "center",
                padding: "12px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--line-2)",
              }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden" }}>
                <ProductImage product={p} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 700 }}>
                  {p.brand}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{p.name}</div>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-4)", fontWeight: 600 }}>Qty {qty}</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{PKR(p.price * qty)}</div>
            </div>
          ))}
        </div>
        <div
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
          {order.status === "Delivered" ? (
            <Btn variant="outline" icon={Icons.heart}>
              Leave a review
            </Btn>
          ) : (
            order.status !== "Cancelled" &&
            (showCancelConfirm ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
            ))
          )}
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
