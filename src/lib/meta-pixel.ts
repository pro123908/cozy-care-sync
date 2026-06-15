type MetaEventPayload = Record<string, unknown>;

const META_DEBUG = true;

function debugMeta(message: string, details?: Record<string, unknown>) {
  if (!META_DEBUG || typeof console === "undefined") return;
  if (details) {
    console.info(`[meta] ${message}`, details);
    return;
  }
  console.info(`[meta] ${message}`);
}

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
  if (!fbq) {
    debugMeta("fbq missing - event not sent", { eventName, payload });
    return false;
  }

  try {
    if (payload && Object.keys(payload).length > 0) {
      fbq("track", eventName, payload);
    } else {
      fbq("track", eventName);
    }
    debugMeta("event sent", { eventName, payload });
    return true;
  } catch (error) {
    debugMeta("fbq threw error", {
      eventName,
      payload,
      error: error instanceof Error ? error.message : String(error),
    });
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
    if (window.sessionStorage.getItem(key)) {
      debugMeta("one-time event skipped (already sent)", { storageKey, eventName, payload });
      return false;
    }
  } catch {
    // If storage is unavailable, still attempt tracking.
    debugMeta("sessionStorage unavailable for one-time guard", { storageKey, eventName });
  }

  const tracked = trackMetaEvent(eventName, payload);
  if (!tracked) return false;

  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Best-effort only.
    debugMeta("could not persist one-time guard key", { storageKey, eventName });
  }

  return true;
}
