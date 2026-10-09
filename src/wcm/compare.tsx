import { Suspense, lazy, useSyncExternalStore } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useWcm } from "./context";
import type { Product } from "./data";
import { Btn, ProductPhoto } from "./ui";
import { trackEngagementEvent } from "@/lib/meta-pixel";

// Product compare: pick up to 3 products from the same category, then see them side by
// side on /compare. The selection lives in localStorage so it survives navigation and
// is shared across tabs of the same browser.

export const COMPARE_MAX = 3;
const STORAGE_KEY = "wcm_compare";

type Entry = { id: string; cat: string };

function load(): Entry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter((e): e is Entry => typeof e?.id === "string" && typeof e?.cat === "string")
          .slice(0, COMPARE_MAX)
      : [];
  } catch {
    return [];
  }
}

let entries: Entry[] = typeof window === "undefined" ? [] : load();
const listeners = new Set<() => void>();

function commit(next: Entry[]) {
  entries = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Selection still works for this visit.
  }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      entries = load();
      listeners.forEach((l) => l());
    }
  });
}

export function useCompareEntries(): Entry[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => entries,
    () => [],
  );
}

export const compareRemove = (id: string) => commit(entries.filter((e) => e.id !== id));
export const compareClear = () => commit([]);
export const compareSet = (next: Entry[]) => commit(next.slice(0, COMPARE_MAX));

/** Adds or removes. Returns a message when the add was refused. */
function compareToggle(product: Product): { added: boolean; refused?: string } {
  if (entries.some((e) => e.id === product.id)) {
    compareRemove(product.id);
    return { added: false };
  }
  if (entries.length >= COMPARE_MAX) {
    return {
      added: false,
      refused: `You can compare up to ${COMPARE_MAX} products. Remove one first.`,
    };
  }
  if (entries.length > 0 && entries[0].cat !== product.cat) {
    return {
      added: false,
      refused: "Compare products from the same category, such as two BP monitors.",
    };
  }
  commit([...entries, { id: product.id, cat: product.cat }]);
  return { added: true };
}

/** Add/remove with tracking. `refused` carries a message when the add was not allowed. */
export function toggleCompare(
  product: Product,
  source: string,
): { added: boolean; refused?: string } {
  const result = compareToggle(product);
  if (result.added) trackCompareAdd(product, source);
  return result;
}

function trackCompareAdd(product: Product, source: string) {
  trackEngagementEvent("CompareAdd", {
    label: product.name,
    source,
    productIds: [product.id],
    extra: { selected: String(entries.length) },
  });
}

export async function copyCompareLink(list: Product[]) {
  const url = `${window.location.origin}/compare?ids=${list.map((p) => p.id).join(",")}`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    window.prompt("Copy this link", url);
  }
}

// ---------------------------------------------------------------------------
// Compare popup state. The product page's Compare button opens it on the picker (same
// category products to choose from); the tray opens it straight on the comparison.
// ---------------------------------------------------------------------------

type ModalState = { open: boolean; view: "pick" | "compare" };
let modalState: ModalState = { open: false, view: "pick" };
const modalListeners = new Set<() => void>();

function setModal(next: ModalState) {
  modalState = next;
  modalListeners.forEach((l) => l());
}

export function useCompareModal(): ModalState {
  return useSyncExternalStore(
    (cb) => {
      modalListeners.add(cb);
      return () => modalListeners.delete(cb);
    },
    () => modalState,
    () => ({ open: false, view: "pick" as const }),
  );
}

/** Starts a comparison from this product: keeps same-category picks, drops anything else. */
export function openComparePicker(product: Product, source: string) {
  const had = entries.some((e) => e.id === product.id);
  const keep = entries
    .filter((e) => e.cat === product.cat && e.id !== product.id)
    .slice(-(COMPARE_MAX - 1));
  commit([...keep, { id: product.id, cat: product.cat }]);
  if (!had) trackCompareAdd(product, source);
  trackEngagementEvent("CompareOpen", {
    label: product.name,
    source,
    productIds: [product.id],
  });
  setModal({ open: true, view: "pick" });
}

/** Opens the popup from the floating bar, straight on the comparison when 2+ are picked. */
export function openCompareView(picked: Product[]) {
  trackEngagementEvent("CompareOpen", {
    label: picked.map((p) => p.name).join(" vs "),
    source: "compare bar",
    productIds: picked.map((p) => p.id),
  });
  setModal({ open: true, view: entries.length >= 2 ? "compare" : "pick" });
}
/** Closing the popup (X, Esc, outside tap, or leaving for a product/cart) ends compare mode. */
export const closeCompareModal = () => {
  commit([]);
  setModal({ ...modalState, open: false });
};
export const setCompareModalView = (view: "pick" | "compare") => setModal({ ...modalState, view });

const CompareModal = lazy(() => import("./compare-modal"));

export function CompareModalHost() {
  const { open } = useCompareModal();
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <CompareModal />
    </Suspense>
  );
}

const CompareIcon = ({ size = 15 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M17 4l4 3-4 3" />
    <path d="M21 7H9" />
    <path d="M7 14l-4 3 4 3" />
    <path d="M3 17h12" />
  </svg>
);

export function CompareToggleButton({
  product,
  variant,
  style,
}: {
  product: Product;
  variant: "icon" | "pill" | "text";
  style?: React.CSSProperties;
}) {
  const { push } = useWcm();
  const list = useCompareEntries();
  const selected = list.some((e) => e.id === product.id);

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // The product page pill opens the popup; cards and the quick view just toggle.
    if (variant === "pill") {
      openComparePicker(product, "product page");
      return;
    }
    const result = toggleCompare(product, variant === "icon" ? "product card" : "quick view");
    if (result.refused) push(result.refused, { tone: "amber" });
  };

  const label = selected ? "Remove from compare" : "Add to compare";

  if (variant === "icon") {
    return (
      <button
        type="button"
        className="wcm-card-compare-btn wcm-card-hover-action wcm-card-wishlist-btn"
        onClick={onClick}
        aria-label={label}
        aria-pressed={selected}
        title={label}
        style={{
          width: 28,
          height: 28,
          borderRadius: 99,
          background: selected ? "var(--pill-teal-bg)" : "var(--card)",
          border: `1px solid ${selected ? "var(--pill-teal-fg)" : "var(--line-2)"}`,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: selected ? "var(--pill-teal-fg)" : "var(--ink-2)",
          boxShadow: "0 8px 14px -10px rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(6px)",
          ...style,
        }}
      >
        <CompareIcon />
      </button>
    );
  }
  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 12px",
          borderRadius: 999,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12.5,
          fontWeight: 700,
          color: selected ? "var(--pill-teal-fg)" : "var(--ink-3)",
          background: selected ? "var(--pill-teal-bg)" : "var(--card)",
          border: `1px solid ${selected ? "var(--pill-teal-fg)" : "var(--line)"}`,
          ...style,
        }}
      >
        <CompareIcon size={14} />
        {selected ? "In compare" : "Compare"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        padding: 0,
        border: "none",
        background: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 13,
        fontWeight: 700,
        color: "var(--blue-700)",
        ...style,
      }}
    >
      {selected ? "Remove from compare" : "Compare"}
    </button>
  );
}

/** Floating bar listing the picked products, with a button to open the comparison. */
export function CompareTray() {
  const list = useCompareEntries();
  const { open: popupOpen } = useCompareModal();
  const { products } = useWcm();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const picked = list
    .map((e) => products.find((p) => p.id === e.id))
    .filter((p): p is Product => Boolean(p));
  const hidden = ["/compare", "/checkout", "/orders", "/track-order"].some((p) =>
    pathname.startsWith(p),
  );
  if (picked.length === 0 || hidden || popupOpen) return null;

  return (
    <div
      className={`wcm-compare-tray${pathname.startsWith("/products/") ? " wcm-compare-tray-pdp" : ""}`}
      role="region"
      aria-label="Compare products"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {picked.map((p) => (
          <div key={p.id} style={{ position: "relative", flexShrink: 0 }}>
            <ProductPhoto
              src={p.image_url || ""}
              alt={p.name}
              containerStyle={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "var(--chip-2)",
                border: "1px solid var(--line)",
              }}
            />
            <button
              type="button"
              onClick={() => compareRemove(p.id)}
              aria-label={`Remove ${p.name} from compare`}
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                width: 18,
                height: 18,
                borderRadius: 99,
                border: "1px solid var(--line)",
                background: "var(--card)",
                color: "var(--ink-3)",
                fontSize: 11,
                lineHeight: 1,
                cursor: "pointer",
                padding: 0,
                zIndex: 3,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={compareClear}
          style={{
            padding: 0,
            border: "none",
            background: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--ink-4)",
          }}
        >
          Clear
        </button>
        <Btn size="sm" disabled={picked.length < 2} onClick={() => openCompareView(picked)}>
          {picked.length < 2 ? "Pick one more" : `Compare ${picked.length}`}
        </Btn>
      </div>
    </div>
  );
}
