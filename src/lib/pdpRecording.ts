import { useEffect } from "react";
import { EventType, type eventWithTime } from "@rrweb/types";
import { getOrCreatePdpSession, trackPdpEvent } from "./pdpAnalytics";

// ---------------------------------------------------------------------------
// Self-hosted session replay — Part 2 of the structured-events + session-
// replay feature. Sampled, site-wide (originally shipped PDP-only, expanded
// per explicit request to cover the whole visit — home, cart, checkout,
// account, everything — not just product pages), admin-only viewing.
//
// See supabase/migrations/20260907030000_session_recordings.sql +
// 20260907040000_session_recordings_product_id_nullable.sql (admin repo) for
// the schema this feeds, and this repo's middleware.ts (`/t/pdp-recording`
// branch) for where chunks land — same secret-key relay pattern as
// pdpAnalytics.ts's `/t/pdp`, for the same reason (navigator.sendBeacon/fetch
// can't carry Supabase's required apikey header directly). The endpoint path
// and DB/table names kept their original "pdp" naming rather than a rename
// across both repos for a scope change with no functional stake in the name.
//
// Masking (`rr-block`/`rr-mask` classes) lives at each risky element itself,
// not here: src/wcm/App.tsx's site header (real account name/email, on
// screen for every route), src/wcm/products.tsx's wishlist/cart state,
// src/wcm/products-card-components.tsx's related-product cards,
// src/wcm/cart.tsx's checkout review step (name/address/phone) and saved-
// address quick-fill, src/wcm/orders.tsx's delivery-address card and rider
// card, and src/routes/account.tsx's email display. This module only wires
// rrweb's `record()` to those class names — it doesn't know what's masked.
//
// A session's recording spans the whole visit, not one row per page —
// session_recordings.session_id is the primary key (shared with
// pdpAnalytics.ts's session so a recording cross-references its structured
// PDP dwell events), and navigating anywhere in the app is just a DOM
// mutation to rrweb, not a reason to stop/restart recording. `product_id` on
// each uploaded chunk reflects whichever product page (if any) was current
// at that moment — see setActivePdpProduct below — and is omitted (not
// overwritten to null) on chunks captured while off a product page, so the
// metadata row keeps the last-known product as its attribution.
// ---------------------------------------------------------------------------

const RECORDING_URL = "/t/pdp-recording";

// Single source of truth for what fraction of sessions get fully recorded.
// Set to 1.0 (100%) at the user's explicit request while actively testing
// this feature — dial this back down once it's trusted, since storage/write
// volume is unbounded at 100% for real production traffic, now across every
// page rather than just PDPs.
const PDP_RECORDING_SAMPLE_RATE = 1;

// Updated by ProductDetail's mount/update/cleanup effect (see products.tsx)
// to whichever product is currently on screen, or null when off a product
// page — read at flush time below, not passed into the hook, since the
// recorder itself is mounted once at the app root and outlives any single
// product page.
let currentPdpProductId: string | null = null;
export function setActivePdpProduct(productId: string | null) {
  currentPdpProductId = productId;
}

// Temporary diagnostic: two separate real mobile visits with substantial
// Part 1 (dwell/event) activity produced zero session_recordings rows even
// after the keepalive fix and the parallel-import startup fix, and two
// separate synthetic reproductions (fast network, then 4x-CPU-throttled
// slow-3G) both succeeded — meaning the failure mode on a real device isn't
// reproducing synthetically. Piggybacked on trackPdpEvent (Part 1's already
// production-proven pipeline, including its pagehide finalizer) rather than
// the recording upload path itself, since that path is exactly what's
// failing to arrive. Only logs when a product page is current, since both
// real failures were on PDPs — remove once root-caused, see PdpEventType.
function debugLog(stage: string, extra: Record<string, unknown> = {}) {
  if (currentPdpProductId) {
    trackPdpEvent("recording_debug", currentPdpProductId, { stage, ...extra });
  }
}

const SAMPLE_DECISION_KEY = "wcm_pdp_recording_sample";
// Fallback flush cadence even without an rrweb checkout boundary, so an
// unusually long checkout interval doesn't hold too much unflushed data in
// memory.
const FALLBACK_FLUSH_MS = 30_000;
// New full-snapshot boundary (and therefore a natural chunk-upload point) —
// see rrweb's checkoutEveryNms option.
const CHECKOUT_INTERVAL_MS = 60_000;

type SampleDecision = { sessionId: string; sampledIn: boolean };

// Tied to the same session_id as pdpAnalytics.ts and decided once per
// session (not re-rolled on every PDP page within one visit).
function isSampledIn(sessionId: string): boolean {
  try {
    const raw = localStorage.getItem(SAMPLE_DECISION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SampleDecision;
      if (parsed.sessionId === sessionId) return parsed.sampledIn;
    }
  } catch {
    // fall through to a fresh roll
  }
  const sampledIn = Math.random() < PDP_RECORDING_SAMPLE_RATE;
  try {
    localStorage.setItem(
      SAMPLE_DECISION_KEY,
      JSON.stringify({ sessionId, sampledIn } satisfies SampleDecision),
    );
  } catch {
    // private mode / storage disabled — the roll still applies for this page view
  }
  return sampledIn;
}

// `keepalive: true` is NOT a "handles bigger payloads than sendBeacon"
// option — confirmed against the actual Fetch/Chromium behavior: every
// keepalive request (regardless of API) shares a single 64KB budget across
// ALL in-flight keepalive requests combined, the identical cap
// navigator.sendBeacon has. Found this the hard way: setting it
// unconditionally on every chunk silently dropped the initial full-snapshot
// chunk (~150-200KB) in real production recordings, along with a few
// periodic re-checkout chunks — the replayer had no base DOM to render,
// producing a blank white player for the entire session. keepalive is only
// needed to survive an actual page teardown; during normal page life a
// plain fetch has no such cap. So: only the pagehide/tab-hidden "last
// chance" flush sets it — everything else uses a normal fetch.
async function uploadChunk(
  sessionId: string,
  productId: string | null,
  chunkIndex: number,
  events: eventWithTime[],
  approxTotalSize: number,
  useKeepalive: boolean,
) {
  if (events.length === 0) return;
  try {
    await fetch(RECORDING_URL, {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        // Omitted (not sent as null) when off a product page, so the
        // middleware's upsert leaves the metadata row's last-known
        // product_id alone instead of clobbering it — see the file header.
        ...(productId ? { product_id: productId } : {}),
        chunk_index: chunkIndex,
        approx_size: approxTotalSize,
        events,
      }),
      keepalive: useKeepalive,
    });
  } catch {
    // Best-effort, same posture as pdpAnalytics.ts — losing a chunk isn't
    // worth surfacing, and the client isn't waiting on a response.
  }
}

// Call once from the app root (see src/wcm/App.tsx) — recording now spans
// the whole visit, not just PDPs, so it starts as soon as any page mounts.
// No-ops entirely for sessions that didn't sample in — @rrweb/record is
// never even imported for them.
export function useSiteRecording() {
  useEffect(() => {
    const session = getOrCreatePdpSession();
    if (!isSampledIn(session.id)) return;

    const mountedAt = performance.now();
    const elapsed = () => Math.round(performance.now() - mountedAt);

    let stopped = false;
    let stopFn: (() => void) | undefined;
    let buffer: eventWithTime[] = [];
    let chunkIndex = 0;
    // Running total across every chunk sent so far this session — sent as
    // an absolute value each time (not a server-side increment), same
    // client-computes-the-total approach as chunkIndex/chunk_count below.
    // A UTF-16 code-unit count from JSON.stringify().length is an estimate,
    // not an exact byte count, but "approx_size" only needs to be roughly
    // right for an admin list column.
    let totalSize = 0;
    let fallbackTimer: number | undefined;
    let startTimer: number | undefined;

    const flush = (isFinal = false) => {
      if (buffer.length === 0) return;
      const toSend = buffer;
      buffer = [];
      const thisChunk = chunkIndex;
      chunkIndex += 1;
      totalSize += JSON.stringify(toSend).length;
      void uploadChunk(session.id, currentPdpProductId, thisChunk, toSend, totalSize, isFinal);
    };

    // rrweb emits a small Meta event first, then the initial FullSnapshot
    // (type 2) — confirmed empirically: a naive "flush after the very first
    // event" only caught the tiny Meta event, leaving the actual (large,
    // ~150-200KB+ observed in real sessions) snapshot sitting buffered.
    // Neither of these sets isCheckout (that flag means "this is a
    // *re*-checkout", not "this is the first one"). The FullSnapshot needs
    // to leave via a normal, unrestricted fetch as soon as it arrives — not
    // sit buffered until whatever flush trigger happens next, which for a
    // short (very common) visit is often the pagehide-triggered *final*
    // flush, where keepalive's 64KB cap silently drops it. Without this,
    // real recordings ended up with no bootstrap snapshot at all — replayer
    // had nothing to render, just a blank white player for the whole
    // session.
    let hasFlushedInitialSnapshot = false;
    let recordingStarted = false;

    // Kick the module fetch off immediately, in parallel with the idle wait
    // below — a background network fetch/parse costs nothing towards LCP,
    // unlike the actual record() call (DOM mutation observers, etc.), which
    // still waits for idle. Importing only after idle fired (the original
    // approach) serialized "wait up to 4s" + "then fetch the chunk," which on
    // a real mobile connection could easily outlast a short visit entirely —
    // confirmed as the likely cause of a real visit with substantial Part 1
    // (dwell/event) activity producing zero Part 2 recording: Part 1 has no
    // such startup gate, so it captured the visit while Part 2's recorder
    // never got past waiting to start.
    const recordModulePromise = import("@rrweb/record");

    const startRecording = async () => {
      if (stopped) return;
      debugLog("idle_fired", { elapsed_ms: elapsed() });
      const { record } = await recordModulePromise;
      if (stopped) return;
      debugLog("import_resolved", { elapsed_ms: elapsed() });
      stopFn = record({
        emit(event, isCheckout) {
          const typedEvent = event as eventWithTime;
          buffer.push(typedEvent);
          if (isCheckout) {
            flush();
          } else if (!hasFlushedInitialSnapshot && typedEvent.type === EventType.FullSnapshot) {
            hasFlushedInitialSnapshot = true;
            debugLog("first_snapshot_flush", { elapsed_ms: elapsed() });
            flush();
          }
        },
        checkoutEveryNms: CHECKOUT_INTERVAL_MS,
        blockClass: "rr-block",
        maskTextClass: "rr-mask",
        maskAllInputs: true,
        recordCanvas: false,
      });
      recordingStarted = true;
      debugLog("record_started", { elapsed_ms: elapsed() });
      fallbackTimer = window.setInterval(flush, FALLBACK_FLUSH_MS);
    };

    // Never start recording (or even import the library) until the page has
    // had a moment to become interactive — don't regress LCP, same posture
    // already applied to pdpAnalytics.ts.
    if (typeof window.requestIdleCallback === "function") {
      startTimer = window.requestIdleCallback(() => void startRecording(), {
        timeout: 4000,
      }) as unknown as number;
    } else {
      startTimer = window.setTimeout(() => void startRecording(), 2000);
    }

    // Same gap pdpAnalytics.ts had and was fixed for: a hard tab-close or
    // browser-level navigation away never runs React's unmount cleanup, so
    // without this, a genuinely common short visit (confirmed for real in
    // production — see pdpAnalytics.ts's pagehide fix) would lose its
    // entire in-progress recording buffer, uploading nothing at all. This is
    // also why the "did recording even start" diagnostic below has to live
    // here, not in the effect's own cleanup — that cleanup is exactly what
    // doesn't run on a real tab-close.
    let reportedTeardownState = false;
    const reportTeardownState = () => {
      if (reportedTeardownState) return;
      reportedTeardownState = true;
      if (!recordingStarted) {
        debugLog("teardown_before_start", { elapsed_ms: elapsed() });
      } else if (!hasFlushedInitialSnapshot) {
        debugLog("teardown_before_first_flush", { elapsed_ms: elapsed() });
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        reportTeardownState();
        flush(true);
      }
    };
    const onPageHide = () => {
      reportTeardownState();
      flush(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      reportTeardownState();
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      if (startTimer != null) {
        if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(startTimer);
        else window.clearTimeout(startTimer);
      }
      if (fallbackTimer != null) window.clearInterval(fallbackTimer);
      stopFn?.();
      // A React unmount (in-app navigation) means the page is still fully
      // alive, not being torn down — no keepalive needed here.
      flush(false);
    };
    // Deliberately empty — mounted once at the app root for the life of the
    // tab, not restarted per route; currentPdpProductId (module-level, set
    // by ProductDetail) keeps uploaded chunks attributed to whichever
    // product page is current, if any.
  }, []);
}
