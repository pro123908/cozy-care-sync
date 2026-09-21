import { beaconMetaEvent } from "./meta-pixel";

// SiteExit: one local-only event each time the page is hidden or closed, with
// how long the visitor actually had the site in view. Browsers can't report a
// true "closed the site" — hiding the tab / switching apps / closing it all look
// the same — so this is "left the page (for now)"; if they come back, later
// events continue the same visit and the admin shows them as live again. On
// coming back a SiteReturn event (with how long they were away) clears the
// "left" state straight away.
//
// The active time is kept in sessionStorage (per tab) and restarts after 30
// minutes of no activity, so it matches the admin's visit boundaries.

const ACTIVE_MS_KEY = "wcm_active_ms";
const LAST_ACTIVE_KEY = "wcm_last_active_at";
const VISIT_GAP_MS = 30 * 60 * 1000;

function readNumber(key: string): number {
  try {
    return Number(window.sessionStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, value: number) {
  try {
    window.sessionStorage.setItem(key, String(value));
  } catch {
    // Best-effort only.
  }
}

export function initSiteExitTracking(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  let activeMs = 0;
  let visibleSince: number | null = null;
  let exitSent = false;
  // When the page was last hidden — set on exit, cleared on return.
  let hiddenAt: number | null = null;

  const startVisible = () => {
    const now = Date.now();
    // A new visit (30+ minutes since last activity) starts the clock over.
    if (now - readNumber(LAST_ACTIVE_KEY) > VISIT_GAP_MS) writeNumber(ACTIVE_MS_KEY, 0);
    activeMs = readNumber(ACTIVE_MS_KEY);
    visibleSince = now;
    exitSent = false;
  };

  const flush = (reason: "hidden" | "pagehide") => {
    const now = Date.now();
    if (visibleSince !== null) {
      activeMs += now - visibleSince;
      visibleSince = null;
      writeNumber(ACTIVE_MS_KEY, activeMs);
      writeNumber(LAST_ACTIVE_KEY, now);
    }
    if (exitSent) return;
    exitSent = true;
    hiddenAt = now;
    beaconMetaEvent(
      "SiteExit",
      {
        content_type: "site",
        // `at` = the visitor's own clock: the admin orders exit/return by it, since the
        // server-side insert order can flip when two events are sent moments apart.
        detail: { seconds: String(Math.round(activeMs / 1000)), page: window.location.pathname, reason, at: String(now) },
      },
    );
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      flush("hidden");
      return;
    }
    // Back on the page after having left it: tell the admin they're here again
    // (otherwise they'd keep showing as "left" until their next tracked action).
    const awaySeconds = hiddenAt !== null ? Math.round((Date.now() - hiddenAt) / 1000) : null;
    startVisible();
    if (awaySeconds !== null) {
      hiddenAt = null;
      beaconMetaEvent("SiteReturn", {
        content_type: "site",
        detail: { away_seconds: String(awaySeconds), page: window.location.pathname, at: String(Date.now()) },
      });
    }
  };
  const onPageHide = () => flush("pagehide");

  if (document.visibilityState === "visible") startVisible();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
  };
}
