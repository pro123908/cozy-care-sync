import { useEffect, useRef, type RefObject } from "react";

// ---------------------------------------------------------------------------
// Self-hosted PDP (product detail page) engagement tracking — Part 1 of the
// structured-events + session-replay feature. Anonymous, PDP-scoped only.
//
// See supabase/migrations/20260907000000_pdp_analytics.sql in the admin repo
// for the analytics_sessions/analytics_events schema this feeds, and this
// repo's middleware.ts (`/t/pdp` branch) for where these POSTs actually
// land. Deliberately NOT a direct call to Supabase: navigator.sendBeacon
// can't set the apikey/Authorization headers Supabase's REST gateway
// requires (unlike src/lib/meta-pixel.ts's raw-fetch calls to meta-track,
// which can set headers because they're never sent via sendBeacon), so this
// relays same-origin instead — same trick middleware.ts already uses for
// GA4 (`/g/*` → proxyGaCollect).
// ---------------------------------------------------------------------------

export type PdpEventType =
  "section_dwell" | "video_play" | "gallery_swipe" | "description_viewed" | "reviews_viewed";

type QueuedEvent = {
  event_type: PdpEventType;
  product_id: string;
  payload: Record<string, unknown>;
};

const TRACK_URL = "/t/pdp";
const SESSION_STORAGE_KEY = "wcm_pdp_session";
// Standard analytics session-timeout convention — a return visit after this
// long counts as a new session rather than continuing the last one. Unlike
// getOrCreateVisitorId() (meta-pixel.ts), which never expires by design.
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const FLUSH_INTERVAL_MS = 10_000;
// Mirrors src/hooks/use-mobile.tsx's MOBILE_BREAKPOINT — duplicated as a
// plain constant here since that breakpoint lives inside a React hook and
// this needs to read it outside of component render (in the flush path).
const MOBILE_BREAKPOINT = 768;

type SessionRecord = { id: string; lastActivityAt: number };

function readSession(): SessionRecord | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionRecord;
    if (!parsed?.id || typeof parsed.lastActivityAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: SessionRecord) {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // private mode / storage disabled — session just won't persist across reloads
  }
}

function getOrCreatePdpSession(): SessionRecord {
  const now = Date.now();
  const existing = readSession();
  const session =
    existing && now - existing.lastActivityAt < SESSION_TIMEOUT_MS
      ? { ...existing, lastActivityAt: now }
      : { id: crypto.randomUUID(), lastActivityAt: now };
  writeSession(session);
  return session;
}

function getDeviceType(): "mobile" | "desktop" {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
    ? "mobile"
    : "desktop";
}

let queue: QueuedEvent[] = [];

// Each mounted usePdpSectionDwell instance registers its own `stop` here so
// a hard page-close/navigation can force every in-progress dwell timer to
// finalize (turn its elapsed time into a queued event) before the final
// flush — otherwise that timer's own React-effect cleanup, which normally
// does this on unmount, never gets a chance to run at all: pagehide/tab-
// close tears down the page without React ever unmounting the component
// first. Without this, a visitor who closes the tab (or hard-navigates
// away) mid-dwell — the single most common way a real visit actually ends —
// loses that entire visit's data, since nothing was ever explicitly queued
// for it to flush (not even the session row).
const activeDwellFinalizers = new Set<() => void>();

function finalizeAllDwells() {
  for (const finalize of activeDwellFinalizers) finalize();
}

export function trackPdpEvent(
  event_type: PdpEventType,
  product_id: string,
  payload: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;
  queue.push({ event_type, product_id, payload });
}

// Only the session_id + freshness (last_seen) get resent every flush —
// first_seen is never included in the client payload, so the DB default
// (now(), applied only on the initial insert) stamps it once and the
// upsert's merge-duplicates resolution never touches it again.
function buildFlushBody(): string | null {
  if (queue.length === 0) return null;
  const events = queue;
  queue = [];
  const session = getOrCreatePdpSession();
  return JSON.stringify({
    session: {
      session_id: session.id,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      device_type: getDeviceType(),
      last_seen: new Date().toISOString(),
    },
    events,
  });
}

function flush(useBeacon: boolean) {
  const body = buildFlushBody();
  if (!body) return;
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(TRACK_URL, new Blob([body], { type: "application/json" }));
    } else {
      void fetch(TRACK_URL, { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // best-effort only — losing an analytics batch isn't worth surfacing
  }
}

// Call once from ProductDetail's top level. Starts the periodic flush loop
// and the unload/hidden-tab beacon, and tears both down on unmount — scope
// is the PDP only, so none of this should outlive the PDP being mounted.
export function usePdpAnalyticsSession() {
  useEffect(() => {
    getOrCreatePdpSession();
    const interval = window.setInterval(() => flush(false), FLUSH_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        finalizeAllDwells();
        flush(true);
      }
    };
    const onPageHide = () => {
      finalizeAllDwells();
      flush(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      finalizeAllDwells();
      flush(true);
    };
  }, []);
}

type ViewedEvent = "description_viewed" | "reviews_viewed";

// IntersectionObserver-based dwell timer for one PDP section. `section` can
// be a plain string or a getter (for the hero gallery/video block, which
// shares one physical container — see products.tsx — so its section label
// depends on whichever media type is active when the timer starts/stops).
// Pauses on a backgrounded tab and resumes on refocus only if the section
// was still actually in view when the tab was hidden.
export function usePdpSectionDwell<T extends HTMLElement>(
  ref: RefObject<T | null>,
  productId: string,
  section: string | (() => string),
  options?: { viewedEvent?: ViewedEvent },
) {
  const dwellStartRef = useRef<number | null>(null);
  const hasFiredViewedRef = useRef(false);
  const isIntersectingRef = useRef(false);
  const sectionGetterRef = useRef(section);
  sectionGetterRef.current = section;

  useEffect(() => {
    hasFiredViewedRef.current = false;
    dwellStartRef.current = null;
  }, [productId]);

  const viewedEvent = options?.viewedEvent;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const currentSection = () => {
      const s = sectionGetterRef.current;
      return typeof s === "function" ? s() : s;
    };

    const start = () => {
      if (dwellStartRef.current == null) dwellStartRef.current = Date.now();
    };
    const stop = () => {
      if (dwellStartRef.current == null) return;
      const ms = Date.now() - dwellStartRef.current;
      dwellStartRef.current = null;
      if (ms > 0) trackPdpEvent("section_dwell", productId, { section: currentSection(), ms });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry?.isIntersecting ?? false;
        isIntersectingRef.current = isVisible;
        if (isVisible) {
          if (document.visibilityState !== "hidden") start();
          if (viewedEvent && !hasFiredViewedRef.current) {
            hasFiredViewedRef.current = true;
            trackPdpEvent(viewedEvent, productId, {});
          }
        } else {
          stop();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    activeDwellFinalizers.add(stop);

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else if (isIntersectingRef.current) {
        start();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      activeDwellFinalizers.delete(stop);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [ref, productId, viewedEvent]);
}
