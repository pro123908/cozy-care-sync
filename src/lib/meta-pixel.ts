type MetaEventPayload = Record<string, unknown>;
type MetaEventUserData = { email?: string; phone?: string };
type MetaTrackOptions = { eventId?: string; userData?: MetaEventUserData };

const META_DEBUG = false;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLIC_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const META_TRACK_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/meta-track` : "";

function debugMeta(message: string, details?: Record<string, unknown>) {
  if (!META_DEBUG || typeof console === "undefined") return;
  if (details) {
    console.info(`[meta] ${message}`, details);
    return;
  }
  console.info(`[meta] ${message}`);
}

async function forwardMetaEvent(
  eventName: string,
  payload?: MetaEventPayload,
  options?: MetaTrackOptions,
) {
  if (!META_TRACK_URL || !SUPABASE_PUBLIC_KEY) {
    debugMeta("meta-track endpoint not configured", { eventName });
    return false;
  }

  const body: Record<string, unknown> = {
    event_name: eventName,
    custom_data: payload || {},
    event_source_url: typeof window !== "undefined" ? window.location.href : "",
  };

  if (options?.eventId) {
    body.event_id = options.eventId;
  }

  const email = options?.userData?.email?.trim();
  const phone = options?.userData?.phone?.trim();
  if (email || phone) {
    body.user_data = {
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    };
  }

  const res = await fetch(META_TRACK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    debugMeta("meta-track request failed", { eventName, status: res.status, response: text });
    return false;
  }

  debugMeta("event forwarded to server", {
    eventName,
    payload,
    eventId: options?.eventId,
    hasUserData: Boolean(email || phone),
  });
  return true;
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

export function trackMetaEvent(
  eventName: string,
  payload?: MetaEventPayload,
  options?: MetaTrackOptions,
) {
  void forwardMetaEvent(eventName, payload, options);
  return true;
}

export function trackMetaEventOnce(
  storageKey: string,
  eventName: string,
  payload?: MetaEventPayload,
  options?: MetaTrackOptions,
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

  void forwardMetaEvent(eventName, payload, {
    ...options,
    eventId: options?.eventId || storageKey,
  });

  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Best-effort only.
    debugMeta("could not persist one-time guard key", { storageKey, eventName });
  }

  return true;
}
