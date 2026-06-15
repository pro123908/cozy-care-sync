type MetaEventPayload = Record<string, unknown>;

declare global {
  interface Window {
    fbq?: (action: "track", eventName: string, payload?: MetaEventPayload) => void;
  }
}

function getFbq() {
  if (typeof window === "undefined") return null;
  if (typeof window.fbq !== "function") return null;
  return window.fbq;
}

export function toMetaValue(value: number | null | undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(2));
}

export function uniqueContentIds(ids: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      ids
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id): id is string => id.length > 0),
    ),
  );
}

export function trackMetaEvent(eventName: string, payload?: MetaEventPayload) {
  const fbq = getFbq();
  if (!fbq) return false;
  try {
    if (payload && Object.keys(payload).length > 0) {
      fbq("track", eventName, payload);
    } else {
      fbq("track", eventName);
    }
    return true;
  } catch {
    return false;
  }
}

export function trackMetaEventOnce(
  storageKey: string,
  eventName: string,
  payload?: MetaEventPayload,
) {
  if (typeof window === "undefined") return false;
  const key = `meta_event_once:${storageKey}`;
  try {
    if (window.sessionStorage.getItem(key)) return false;
  } catch {
    // If storage is unavailable, still attempt tracking.
  }

  const tracked = trackMetaEvent(eventName, payload);
  if (!tracked) return false;

  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Best-effort only.
  }

  return true;
}
