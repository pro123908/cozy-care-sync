type MetaEventPayload = Record<string, unknown>;
type MetaEventUserData = { email?: string; phone?: string };
type MetaTrackOptions = {
  eventId?: string;
  userData?: MetaEventUserData;
  /** Let the request outlive the page (used by SiteExit while the tab closes). */
  keepalive?: boolean;
};

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
    // Capture fbclid from URL (present when user arrives via a Meta ad).
    // Always overwrite on a fresh fbclid so a later ad click gets credit
    // over a stale one from a much earlier visit.
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid") || "";
    if (fbclid) {
      localStorage.setItem(FBC_STORAGE_KEY, buildFbc(fbclid));
    }
    // Fall back to existing _fbc cookie (set by pixel on previous visits)
    if (!localStorage.getItem(FBC_STORAGE_KEY)) {
      const cookieFbc = getCookie("_fbc");
      if (cookieFbc) localStorage.setItem(FBC_STORAGE_KEY, cookieFbc);
    }
    // Capture _fbp cookie (browser-level identifier set by Meta pixel)
    if (!localStorage.getItem(FBP_STORAGE_KEY)) {
      const cookieFbp = getCookie("_fbp");
      if (cookieFbp) localStorage.setItem(FBP_STORAGE_KEY, cookieFbp);
    }
  } catch {
    // storage unavailable — silently skip
  }
}

// Purchases routinely happen in a later browser session than the ad click
// (server-side CAPI fires at order completion, not at click time), so fbc/fbp
// must survive a tab close — sessionStorage does not, localStorage does.
export function getMetaBrowserIds(): { fbc?: string; fbp?: string } {
  if (typeof window === "undefined") return {};
  try {
    const fbc = localStorage.getItem(FBC_STORAGE_KEY) || undefined;
    const fbp = localStorage.getItem(FBP_STORAGE_KEY) || undefined;
    return { fbc, fbp };
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Anonymous visitor id
// ---------------------------------------------------------------------------
//
// `_fbp`/`_fbc` only exist when Meta's pixel JS has run on this browser, which
// isn't reliably the case here (events are fired server-side via CAPI). This
// is our own stable id so admin-side "unique visits" isn't stuck approximating
// uniqueness from IP address, which both over- and under-counts real people
// (shared NAT/office wifi vs. one person switching networks).

const VISITOR_ID_KEY = "wcm_visitor_id";

export function getOrCreateVisitorId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let id = window.localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    // storage unavailable (private mode, etc.) — event still fires, just
    // without a persistent id for this visitor.
    return undefined;
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

  const visitorId = getOrCreateVisitorId();
  if (visitorId) {
    body.visitor_id = visitorId;
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
    ...(options?.keepalive ? { keepalive: true } : {}),
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

export type BundleClickSource =
  | "home page"
  | "deals page"
  | "bundle page"
  | "product page"
  | "cart"
  | "checkout"
  | "mix & match";

export type BundleEventName = "BundleClick" | "BundleBuilderPick" | "BundleBuildClick" | "BundleApplied";

type BundleEventInput = {
  productIds: string[];
  /** Human label: "<A> + <B>" or the product being acted on. */
  label: string;
  source: BundleClickSource;
  /** Bundle price after discount, in PKR (when known). */
  value?: number;
  /** Extra flat string detail, e.g. { slot: "first", discount: "200" }. */
  extra?: Record<string, string>;
};

function bundleEventPayload(input: BundleEventInput) {
  return {
    content_ids: input.productIds,
    content_type: "product_group",
    ...(input.value != null ? { value: input.value, currency: "PKR" } : {}),
    // Stored in meta_events.event_detail (flat strings — see meta-track's sanitizeDetail).
    detail: { label: input.label, source: input.source, ...input.extra },
  };
}

/**
 * Bundle interaction events. All are local-only (logged to meta_events for the
 * admin feed, never forwarded to Meta's Conversions API):
 *  - BundleClick: "Add both" on a ready-made bundle or the mix & match builder
 *  - BundleBuilderPick: a product picked in the "Build your own bundle" card
 *  - BundleBuildClick: the "Build a bundle" button on a product page
 *  - BundleApplied: a bundle actually formed in the cart/checkout (once per pair per session)
 */
export function trackBundleEvent(name: BundleEventName, input: BundleEventInput) {
  trackMetaEvent(name, bundleEventPayload(input));
}

export function trackBundleClick(input: BundleEventInput) {
  trackBundleEvent("BundleClick", input);
}

export function trackBundleAppliedOnce(pairKey: string, input: BundleEventInput) {
  trackMetaEventOnce(`bundle_applied:${pairKey}`, "BundleApplied", bundleEventPayload(input));
}

/**
 * Send an event while the page is being hidden/closed. `fetch` with the
 * Supabase auth headers needs a CORS preflight, which often can't finish
 * before the page freezes (exit events were getting lost); `sendBeacon` to a
 * same-origin relay (middleware.ts `/t/presence`, which adds the headers
 * server-side) is delivered reliably. Only SiteExit/SiteReturn are accepted by
 * the relay. Falls back to a keepalive fetch if sendBeacon is unavailable.
 */
export function beaconMetaEvent(eventName: string, payload?: MetaEventPayload) {
  if (typeof window === "undefined") return;
  const body: Record<string, unknown> = {
    event_name: eventName,
    custom_data: payload || {},
    event_source_url: window.location.href,
  };
  const visitorId = getOrCreateVisitorId();
  if (visitorId) body.visitor_id = visitorId;
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.sendBeacon &&
      navigator.sendBeacon("/t/presence", new Blob([JSON.stringify(body)], { type: "application/json" }))
    ) {
      return;
    }
  } catch {
    // fall through to the fetch fallback
  }
  void forwardMetaEvent(eventName, payload, { keepalive: true });
}
