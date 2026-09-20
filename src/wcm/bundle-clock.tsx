import { useEffect, useState, useSyncExternalStore } from "react";
import { BUNDLE_DEALS_END_MS, bundlesActive } from "./data";

// One shared timer for every component that depends on the bundle window: when
// the deadline passes they all re-render once, so discounts/chips/free-delivery
// disappear without a page reload (computeBundles itself reads the clock).
const listeners = new Set<() => void>();
let timer: number | undefined;

function schedule() {
  const ms = BUNDLE_DEALS_END_MS - Date.now();
  if (ms <= 0) return;
  // setTimeout caps at ~24.8 days — re-arm if the deadline is further out.
  timer = window.setTimeout(() => {
    timer = undefined;
    if (bundlesActive()) schedule();
    else listeners.forEach((l) => l());
  }, Math.min(ms + 50, 2_147_000_000));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (timer === undefined && typeof window !== "undefined") schedule();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };
}

/** True until the bundle deals' deadline; re-renders the caller when it passes. */
export function useBundlesActive(): boolean {
  return useSyncExternalStore(subscribe, () => bundlesActive(), () => true);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Ticks every second; null before mount (SSR-safe) and after the deadline. */
function useCountdownParts() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (now === null) return null;
  const left = BUNDLE_DEALS_END_MS - now;
  if (left <= 0) return null;
  const s = Math.floor(left / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

/** Live "Ends in 1d 04h 12m 09s" pill. Renders nothing before mount or after the deadline. */
export function BundleCountdown({ style }: { style?: React.CSSProperties }) {
  const t = useCountdownParts();
  if (!t) return null;
  const text =
    t.d > 0 ? `${t.d}d ${pad(t.h)}h ${pad(t.m)}m ${pad(t.s)}s` : `${pad(t.h)}:${pad(t.m)}:${pad(t.s)}`;
  return (
    <span
      role="timer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 999,
        background: "var(--pill-rose-bg)",
        color: "var(--pill-rose-fg)",
        fontSize: 12,
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span aria-hidden="true">⏳</span> Ends in <strong style={{ fontWeight: 800 }}>{text}</strong>
    </span>
  );
}

/** Small tinted digit tiles (DAYS / HRS / MIN / SEC). */
export function BundleCountdownTiles() {
  const t = useCountdownParts();
  if (!t) return null;
  const tiles = [
    ...(t.d > 0 ? [{ v: t.d, label: "Days" }] : []),
    { v: t.h, label: "Hrs" },
    { v: t.m, label: "Min" },
    { v: t.s, label: "Sec" },
  ];
  return (
    <div role="timer" style={{ display: "flex", gap: 7 }}>
      {tiles.map((tile) => (
        <div
          key={tile.label}
          style={{
            minWidth: 51,
            padding: "7px 4px",
            borderRadius: 11,
            background: "var(--pill-rose-bg)",
            color: "var(--pill-rose-fg)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {pad(tile.v)}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 3, opacity: 0.85 }}>
            {tile.label}
          </div>
        </div>
      ))}
    </div>
  );
}
