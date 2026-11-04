// Order tracking page pieces (used by OrderDetail in ./orders.tsx, i.e. both
// /track-order and My Orders): a status hero with a tappable 5-step journey,
// the courier's updates in plain words, and a live-refresh hook.
//
// Customer-facing wording comes from ./courier-events.ts (raw courier text is
// translated there; unknown wording falls back to the courier's own text).

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Order } from "./data";
import { Icons } from "./icons";
import { Btn, Section } from "./ui";
import {
  describeCourierEvent,
  formatEventTime,
  type CourierEventKind,
  type CourierEventView,
} from "./courier-events";

// Short on purpose: on a phone each of the 5 columns is only ~60px wide, and "Processing" (the
// internal status name) is wider than that and ran into its neighbour. "Packing" says the same thing.
const STEP_LABELS = ["Placed", "Confirmed", "Packing", "On the way", "Delivered"];

const providerLabel = (provider: string) => (provider === "postex" ? "PostEx" : "Leopards");

// Both are real public tracking pages, confirmed by driving each in a browser (Aug 2026).
function courierTrackingUrl(provider: string, trackingNumber: string): string {
  if (provider === "postex")
    return `https://postex.pk/tracking?cn=${encodeURIComponent(trackingNumber)}`;
  return `https://pk.leopardscourier.com/shipment_tracking_view?cn_number=${encodeURIComponent(trackingNumber)}`;
}

type LatestEvent = { view: CourierEventView; at: string };

function latestEvent(order: Order): LatestEvent | null {
  const history = order.courier?.statusHistory;
  if (!history || history.length === 0) return null;
  // History is stored oldest-first, so the last entry is the newest.
  const e = history[history.length - 1];
  return { view: describeCourierEvent(e.status, e.statusWithCity), at: e.at };
}

type Tone = "blue" | "green" | "amber" | "rose";
const TONE: Record<Tone, { bg: string; fg: string; solid: string }> = {
  blue: { bg: "var(--pill-info-bg)", fg: "var(--pill-info-fg)", solid: "var(--blue-600)" },
  green: { bg: "var(--pill-success-bg)", fg: "var(--pill-success-fg)", solid: "var(--green-500)" },
  amber: { bg: "var(--pill-warn-bg)", fg: "var(--pill-warn-fg)", solid: "#d97706" },
  rose: { bg: "var(--pill-rose-bg)", fg: "var(--pill-rose-fg)", solid: "#e11d48" },
};

const kindTone = (kind: CourierEventKind): Tone =>
  kind === "attempt" || kind === "hold"
    ? "amber"
    : kind === "return" || kind === "cancelled"
      ? "rose"
      : kind === "delivered"
        ? "green"
        : "blue";

function heroCopy(
  order: Order,
  step: number,
  latest: LatestEvent | null,
): { title: string; sub: string; tone: Tone } {
  if (order.status === "Cancelled")
    return { title: "Order cancelled", sub: "This order won't be delivered.", tone: "rose" };
  if (order.status === "Returned")
    return { title: "Order returned", sub: "The parcel has come back to us.", tone: "rose" };
  if (order.status === "Delivered")
    return {
      title: "Delivered",
      sub: order.eta ? `on ${order.eta}` : "Enjoy your order!",
      tone: "green",
    };
  if (step >= 3 && latest) {
    const { kind, title, detail } = latest.view;
    const when = formatEventTime(latest.at);
    if (kind === "attempt")
      return { title: "We couldn't deliver yet", sub: detail ?? title, tone: "amber" };
    if (kind === "hold") return { title: title, sub: detail ?? "", tone: "amber" };
    if (kind === "return")
      return { title: "Parcel is coming back to us", sub: `${title} · ${when}`, tone: "rose" };
    return { title: "On its way to you", sub: `${title} · ${when}`, tone: "blue" };
  }
  if (step >= 3) return { title: "On its way to you", sub: "Handed to the courier.", tone: "blue" };
  if (step === 2)
    return {
      title: "Packing your order",
      sub: "We'll update this once it's with the courier.",
      tone: "blue",
    };
  if (step === 1)
    return { title: "Order confirmed", sub: "Next, we pack it for dispatch.", tone: "blue" };
  return { title: "Order received", sub: "We'll confirm it shortly.", tone: "blue" };
}

function stepDetail(order: Order, i: number, step: number, latest: LatestEvent | null): string {
  if (i > step) return "Not reached yet.";
  switch (i) {
    case 0:
      return `We received your order on ${order.placed}.`;
    case 1:
      return "Our team confirmed your order.";
    case 2:
      return "We pack your order and get it ready for the courier.";
    case 3: {
      if (!order.courier) return "Preparing for dispatch.";
      const base = `With ${providerLabel(order.courier.provider)} (tracking ${order.courier.trackingNumber}).`;
      return latest ? `${base} Latest: ${latest.view.title}, ${formatEventTime(latest.at)}.` : base;
    }
    default:
      return order.eta ? `Delivered on ${order.eta}.` : "Delivered.";
  }
}

function timeAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

// ---------------------------------------------------------------------------
// Live refresh: re-reads the order while the page is open and visible, and
// whenever the customer comes back to the tab. It only reads our own cached
// courier data (no courier API calls), so a minute-scale poll costs nothing.
// ---------------------------------------------------------------------------
export function useLiveRefresh(
  onRefresh: (() => Promise<void>) | undefined,
  active: boolean,
  intervalMs = 90_000,
) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(() => Date.now());
  const refreshedAtRef = useRef(refreshedAt);
  const busy = useRef(false);
  const latestFn = useRef(onRefresh);

  useEffect(() => {
    latestFn.current = onRefresh;
  }, [onRefresh]);

  const refreshNow = useCallback(async () => {
    const fn = latestFn.current;
    if (!fn || busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      await fn();
      refreshedAtRef.current = Date.now();
      setRefreshedAt(refreshedAtRef.current);
    } catch {
      // keep showing the last good data; the next tick retries
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!onRefresh || !active) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshNow();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - refreshedAtRef.current > 30_000)
        void refreshNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [onRefresh, active, intervalMs, refreshNow]);

  return { refreshing, refreshedAt, refreshNow };
}

function CopyChip({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) return;
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard blocked: the value stays visible to copy by hand
    }
  };
  return (
    <button type="button" onClick={copy} className="wcm-copy-id" aria-label={label} title={label}>
      {copied ? (
        <span className="wcm-copy-check" style={{ display: "inline-flex" }}>
          {Icons.check}
        </span>
      ) : (
        Icons.copy
      )}
    </button>
  );
}

export function TrackingHero({
  order,
  step,
  refresh,
  onContact,
  onUpdated,
}: {
  order: Order;
  step: number;
  refresh?: { refreshing: boolean; refreshedAt: number; onRefresh: () => void };
  onContact: (message?: string) => void;
  /** Fired when a refresh brings a new status or courier update. */
  onUpdated?: (title: string) => void;
}) {
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [, setTick] = useState(0);
  const latest = latestEvent(order);
  const closed = step < 0; // cancelled / returned: no journey to draw
  const copy = heroCopy(order, closed ? -1 : step, latest);
  const tone = TONE[copy.tone];
  const action = latest?.view.action;

  // Re-render every 30s so "Updated 2 min ago" stays honest.
  useEffect(() => {
    if (!refresh) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  // A refresh that changes the status or the newest courier update flashes the card and says so.
  const key = `${order.status}|${order.courier?.statusHistory?.length ?? 0}|${latest?.at ?? ""}`;
  const prevKey = useRef(key);
  useEffect(() => {
    if (prevKey.current === key) return;
    prevKey.current = key;
    setFlash(true);
    onUpdated?.(copy.title);
    const id = window.setTimeout(() => setFlash(false), 1800);
    return () => window.clearTimeout(id);
  }, [key, copy.title, onUpdated]);

  const courierLabel = order.courier ? providerLabel(order.courier.provider) : null;
  const contextual =
    action === "address"
      ? {
          label: "Send correct address",
          message: `Hi, my order ${order.id}: the delivery address needs correcting. Correct address: `,
        }
      : action === "availability"
        ? {
            label: "Tell us when you're free",
            message: `Hi, my order ${order.id}: I'll be available for delivery at: `,
          }
        : null;

  return (
    <Section
      className={`wcm-track-in wcm-trk-hero${flash ? " wcm-trk-flash" : ""}`}
      style={{ padding: 0, overflow: "hidden" }}
    >
      <div
        style={{
          height: 3,
          background: copy.tone === "blue" || copy.tone === "green" ? "var(--grad)" : tone.solid,
        }}
      />
      <div className="wcm-trk-hero-body" style={{ padding: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            color: "var(--ink-4)",
            fontSize: 13,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 700,
                color: "var(--ink-2)",
                whiteSpace: "nowrap",
              }}
            >
              {order.id}
            </span>
            <CopyChip value={order.id} label="Copy order ID" />
            <span aria-hidden="true">·</span>
            <span style={{ whiteSpace: "nowrap" }}>Placed {order.placed}</span>
          </div>
          {refresh && !closed && order.status !== "Delivered" && (
            <button
              type="button"
              className="wcm-trk-refresh"
              onClick={refresh.onRefresh}
              disabled={refresh.refreshing}
              title="Check for the latest update"
            >
              <span
                className={refresh.refreshing ? "wcm-trk-spin" : undefined}
                style={{ display: "inline-flex" }}
              >
                {Icons.refresh}
              </span>
              {refresh.refreshing ? "Checking…" : `Updated ${timeAgo(refresh.refreshedAt)}`}
            </button>
          )}
        </div>

        <h1
          className="wcm-trk-title"
          style={{
            margin: "14px 0 0",
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: -0.5,
            lineHeight: 1.15,
            color: "var(--ink)",
          }}
        >
          {copy.title}
        </h1>
        {copy.sub && (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginTop: 6,
              fontSize: 14.5,
              lineHeight: 1.45,
              color: copy.tone === "amber" ? tone.fg : "var(--ink-3)",
              fontWeight: copy.tone === "amber" ? 600 : 400,
            }}
          >
            {copy.sub}
          </div>
        )}

        {order.courier && (
          <div
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 6px 5px 11px",
              borderRadius: 999,
              background: "var(--bg-elev)",
              border: "1px solid var(--line)",
              fontSize: 12.5,
              color: "var(--ink-3)",
            }}
          >
            <span style={{ display: "inline-flex", color: "var(--ink-4)" }}>{Icons.truck}</span>
            <span style={{ fontWeight: 700, color: "var(--ink-2)" }}>{courierLabel}</span>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>
              {order.courier.trackingNumber}
            </span>
            <CopyChip value={order.courier.trackingNumber} label="Copy tracking number" />
          </div>
        )}

        {!closed && (
          <div style={{ marginTop: 22 }}>
            <div
              role="group"
              aria-label={`Order journey, step ${step + 1} of ${STEP_LABELS.length}`}
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: `repeat(${STEP_LABELS.length}, minmax(0, 1fr))`,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 13,
                  left: "10%",
                  right: "10%",
                  height: 3,
                  borderRadius: 99,
                  background: "var(--chip)",
                  overflow: "hidden",
                }}
              >
                <div
                  className="wcm-track-progress-fill"
                  style={{
                    height: "100%",
                    borderRadius: 99,
                    width: `${(step / (STEP_LABELS.length - 1)) * 100}%`,
                    background: order.status === "Delivered" ? "var(--green-500)" : "var(--grad)",
                  }}
                />
              </div>
              {STEP_LABELS.map((label, i) => {
                const done = i <= step;
                const current = i === step && order.status !== "Delivered";
                const open = openStep === i;
                return (
                  <button
                    key={label}
                    type="button"
                    className="wcm-trk-step"
                    aria-expanded={open}
                    aria-label={`${label}: ${i < step || (i === step && order.status === "Delivered") ? "done" : current ? "current" : "not yet"}`}
                    onClick={() => setOpenStep(open ? null : i)}
                  >
                    <span
                      style={{
                        position: "relative",
                        width: 28,
                        height: 28,
                        display: "inline-flex",
                      }}
                    >
                      {current && (
                        <span
                          className="wcm-track-ping"
                          style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: 99,
                            background: tone.solid,
                          }}
                        />
                      )}
                      <span
                        className={`wcm-trk-node${done ? " wcm-track-step-in" : ""}`}
                        style={{
                          position: "relative",
                          width: 28,
                          height: 28,
                          borderRadius: 99,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: done
                            ? current
                              ? tone.solid
                              : "var(--green-500)"
                            : "var(--card)",
                          border: done ? "none" : "2px solid var(--line)",
                          color: "#fff",
                          boxShadow: open
                            ? `0 0 0 4px ${tone.bg}`
                            : current
                              ? `0 0 0 4px ${tone.bg}`
                              : "none",
                          animationDelay: `${i * 0.1}s`,
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
                      </span>
                    </span>
                    <span
                      className="wcm-trk-label"
                      style={{
                        fontSize: 11.5,
                        fontWeight: i === step ? 800 : 600,
                        color: done ? "var(--ink)" : "var(--ink-4)",
                        textAlign: "center",
                        lineHeight: 1.2,
                        maxWidth: "100%",
                        // last resort on a very narrow screen: break the word rather than overlap the next label
                        overflowWrap: "anywhere",
                      }}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            {openStep !== null && (
              <div
                key={openStep}
                className="wcm-track-in"
                style={{
                  marginTop: 14,
                  padding: "11px 13px",
                  borderRadius: 12,
                  background: "var(--bg-elev)",
                  border: "1px solid var(--line)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>
                  {STEP_LABELS[openStep]}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5 }}>
                  {stepDetail(order, openStep, step, latest)}
                </div>
              </div>
            )}
          </div>
        )}

        <div
          className="wcm-trk-actions"
          style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          {contextual && (
            <Btn size="sm" icon={Icons.whatsapp} onClick={() => onContact(contextual.message)}>
              {contextual.label}
            </Btn>
          )}
          {order.courier && order.status !== "Cancelled" && (
            <Btn
              size="sm"
              variant="outline"
              icon={Icons.truck}
              onClick={() =>
                window.open(
                  courierTrackingUrl(order.courier!.provider, order.courier!.trackingNumber),
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              Track on {courierLabel} ↗
            </Btn>
          )}
          <Btn size="sm" variant="outline" icon={Icons.phone} onClick={() => onContact()}>
            Contact us
          </Btn>
        </div>
      </div>
    </Section>
  );
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
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
    {children}
  </div>
);

export function TrackingUpdates({ order }: { order: Order }) {
  const [showAll, setShowAll] = useState(false);
  const history = order.courier?.statusHistory ?? [];
  const items = [...history]
    .reverse()
    .map((e) => ({ view: describeCourierEvent(e.status, e.statusWithCity), at: e.at }));
  const COLLAPSED = 1;
  const visible = showAll ? items : items.slice(0, COLLAPSED);
  const hidden = items.length - COLLAPSED;

  return (
    <Section
      className="wcm-track-in wcm-track-card"
      style={{ padding: 20, animationDelay: "0.1s" }}
    >
      <SectionLabel>Courier updates</SectionLabel>

      {items.length === 0 ? (
        <div style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.55 }}>
          {order.courier
            ? "Updates will appear here as soon as the courier scans your parcel."
            : "Courier updates will appear here once your parcel is handed over."}{" "}
          This page checks for news on its own while it's open.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {visible.map((item, i) => {
            const latest = i === 0;
            const t = TONE[kindTone(item.view.kind)];
            const last = i === visible.length - 1;
            return (
              <div
                key={`${item.at}-${i}`}
                className={i >= COLLAPSED ? "wcm-track-history-row" : undefined}
                style={{
                  display: "grid",
                  gridTemplateColumns: "20px 1fr",
                  gap: 12,
                  position: "relative",
                  paddingBottom: last ? 0 : 16,
                  animationDelay: `${(i - COLLAPSED) * 0.04}s`,
                }}
              >
                {!last && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: 9,
                      top: 20,
                      bottom: 0,
                      width: 2,
                      background: "var(--chip)",
                    }}
                  />
                )}
                <span
                  aria-hidden="true"
                  style={{
                    position: "relative",
                    width: 20,
                    height: 20,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      width: latest ? 12 : 8,
                      height: latest ? 12 : 8,
                      borderRadius: 99,
                      background: latest ? t.solid : "var(--chip-2)",
                      boxShadow: latest ? `0 0 0 4px ${t.bg}` : "none",
                    }}
                  />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: latest ? 15 : 13.5,
                      fontWeight: latest ? 800 : 600,
                      color: latest ? "var(--ink)" : "var(--ink-2)",
                      lineHeight: 1.3,
                    }}
                  >
                    {item.view.title}
                  </div>
                  {item.view.detail && (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--ink-3)",
                        marginTop: 2,
                        lineHeight: 1.45,
                      }}
                    >
                      {item.view.detail}
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }}>
                    {formatEventTime(item.at)}
                  </div>
                </div>
              </div>
            );
          })}
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="wcm-track-toggle"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                marginTop: 14,
                padding: 0,
                border: "none",
                background: "none",
                color: "var(--blue-600)",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                alignSelf: "flex-start",
              }}
            >
              {showAll ? "Show less" : `Earlier updates (${hidden})`}
              <span
                className={`wcm-track-chevron${showAll ? " open" : ""}`}
                style={{ display: "inline-flex" }}
              >
                {Icons.chevD}
              </span>
            </button>
          )}
        </div>
      )}

      {order.rider && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 12px",
            borderRadius: 11,
            background: "var(--blue-50)",
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
          <a href={`tel:${order.rider.phone}`} style={{ textDecoration: "none" }}>
            <Btn variant="outline" size="sm" icon={Icons.phone}>
              Call
            </Btn>
          </a>
        </div>
      )}
    </Section>
  );
}
