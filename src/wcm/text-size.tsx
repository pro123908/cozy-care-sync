import { useSyncExternalStore } from "react";
import { trackEngagementEvent } from "@/lib/meta-pixel";

// Larger-text mode for the storefront. Everything is sized with inline px, so root
// font-size scaling would do nothing; instead the page chrome (header, main content,
// footer) gets CSS `zoom` through `.wcm-zoomable` (see styles.css), driven by the
// `data-wcm-text` attribute on <html>. A zoomed full-width block re-flows like browser
// zoom, so nothing overflows sideways. Popups and the cart drawer keep their own size.

export type TextSize = "md" | "lg" | "xl";

const STORAGE_KEY = "wcm_text_size";
const ORDER: TextSize[] = ["md", "lg", "xl"];
export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  md: "Normal",
  lg: "Large",
  xl: "Extra large",
};

let current: TextSize = "md";
const listeners = new Set<() => void>();

function apply(size: TextSize) {
  if (typeof document === "undefined") return;
  if (size === "md") document.documentElement.removeAttribute("data-wcm-text");
  else document.documentElement.setAttribute("data-wcm-text", size);
}

/** Call once before the first render so there is no flash of normal-sized text. */
export function initTextSize() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "lg" || saved === "xl") current = saved;
  } catch {
    // Storage blocked: stay on the default size.
  }
  apply(current);
}

export function setTextSize(size: TextSize, source: string) {
  if (size === current) return;
  current = size;
  apply(size);
  try {
    if (size === "md") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Still applies for this visit.
  }
  listeners.forEach((l) => l());
  trackEngagementEvent("TextSizeChanged", { label: TEXT_SIZE_LABELS[size], source });
}

export function useTextSize(): TextSize {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => "md",
  );
}

/** Header button: cycles Normal -> Large -> Extra large -> Normal. */
export function TextSizeButton({ style }: { style?: React.CSSProperties }) {
  const size = useTextSize();
  const next = ORDER[(ORDER.indexOf(size) + 1) % ORDER.length];
  return (
    <button
      type="button"
      onClick={() => setTextSize(next, "header")}
      aria-label={`Text size: ${TEXT_SIZE_LABELS[size]}. Switch to ${TEXT_SIZE_LABELS[next]}`}
      title={`Text size: ${TEXT_SIZE_LABELS[size]}`}
      style={{
        ...style,
        fontWeight: 800,
        fontFamily: "inherit",
        fontSize: 14,
        letterSpacing: -0.3,
        color: size === "md" ? "var(--ink-2)" : "var(--pill-teal-fg)",
      }}
    >
      A<span style={{ fontSize: 11 }}>a</span>
      <span style={{ fontSize: 10.5 }}>{size === "xl" ? "++" : size === "lg" ? "+" : ""}</span>
    </button>
  );
}

/** Menu row with all three sizes visible at once (mobile menu). */
export function TextSizeRow() {
  const size = useTextSize();
  return (
    <div style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-4)", marginBottom: 8 }}>
        Text size
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {ORDER.map((s, i) => {
          const active = s === size;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setTextSize(s, "menu")}
              aria-pressed={active}
              aria-label={TEXT_SIZE_LABELS[s]}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 10,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 800,
                fontSize: 13 + i * 3,
                lineHeight: 1.1,
                color: active ? "var(--pill-teal-fg)" : "var(--ink-3)",
                background: active ? "var(--pill-teal-bg)" : "var(--card)",
                border: `1px solid ${active ? "var(--pill-teal-fg)" : "var(--line)"}`,
              }}
            >
              A
            </button>
          );
        })}
      </div>
    </div>
  );
}
