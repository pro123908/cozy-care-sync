type MetaEventPayload = Record<string, unknown>;
type MetaEventUserData = { email?: string; phone?: string };
type MetaTrackOptions = { eventId?: string; userData?: MetaEventUserData };

// ---------------------------------------------------------------------------
// fbc / fbp helpers
// ---------------------------------------------------------------------------

const FBC_STORAGE_KEY = "meta_fbc";
const FBP_STORAGE_KEY = "meta_fbp";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function buildFbc(fbclid: string): string {
  // Format required by Meta: fb.1.{unix_ms}.{fbclid}
  return `fb.1.${Date.now()}.${fbclid}`;
}

function initMetaBrowserIds(): void {
  if (typeof window === "undefined") return;
  try {
    // Capture fbclid from URL (present when user arrives via a Meta ad)
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid") || "";
    if (fbclid) {
      sessionStorage.setItem(FBC_STORAGE_KEY, buildFbc(fbclid));
    }
    // Fall back to existing _fbc cookie (set by pixel on previous visits)
    if (!sessionStorage.getItem(FBC_STORAGE_KEY)) {
      const cookieFbc = getCookie("_fbc");
      if (cookieFbc) sessionStorage.setItem(FBC_STORAGE_KEY, cookieFbc);
    }
    // Capture _fbp cookie (browser-level identifier set by Meta pixel)
    if (!sessionStorage.getItem(FBP_STORAGE_KEY)) {
      const cookieFbp = getCookie("_fbp");
      if (cookieFbp) sessionStorage.setItem(FBP_STORAGE_KEY, cookieFbp);
    }
  } catch {
    // storage unavailable — silently skip
  }
}

export function getMetaBrowserIds(): { fbc?: string; fbp?: string } {
  if (typeof window === "undefined") return {};
  try {
    const fbc = sessionStorage.getItem(FBC_STORAGE_KEY) || undefined;
    const fbp = sessionStorage.getItem(FBP_STORAGE_KEY) || undefined;
    return { fbc, fbp };
  } catch {
    return {};
  }
}

// Run once at module load
initMetaBrowserIds();

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
  const { fbc, fbp } = getMetaBrowserIds();
  if (email || phone || fbc || fbp) {
    body.user_data = {
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(fbc ? { fbc } : {}),
      ...(fbp ? { fbp } : {}),
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
