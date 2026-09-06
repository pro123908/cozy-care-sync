import { useEffect, useRef } from "react";
import type { eventWithTime } from "@rrweb/types";
import { getOrCreatePdpSession } from "./pdpAnalytics";

// ---------------------------------------------------------------------------
// Self-hosted PDP session replay — Part 2 of the structured-events +
// session-replay feature. Sampled, PDP-only, admin-only viewing.
//
// See supabase/migrations/20260907030000_session_recordings.sql (admin
// repo) for the schema this feeds, and this repo's middleware.ts
// (`/t/pdp-recording` branch) for where chunks land — same secret-key
// relay pattern as pdpAnalytics.ts's `/t/pdp`, for the same reason
// (navigator.sendBeacon/fetch can't carry Supabase's required apikey
// header directly).
//
// Masking (`rr-block`/`rr-mask` classes) lives at each risky element
// itself, not here — src/wcm/App.tsx's site header (real account
// name/email, on-screen for every PDP view even though it isn't part of
// ProductDetail), src/wcm/products.tsx's wishlist/cart state, and
// src/wcm/products-card-components.tsx's related-product cards. This
// module only wires rrweb's `record()` to those class names.
//
// A session's recording spans the whole visit, not one row per product —
// session_recordings.session_id is the primary key (shared with
// pdpAnalytics.ts's session so a recording cross-references its structured
// dwell events), and navigating from one PDP to another within the same
// session is just a DOM mutation to rrweb, not a reason to stop/restart
// recording. `product_id` on each uploaded chunk reflects whichever
// product was current at that moment; the metadata row's `product_id`
// following it is an accepted simplification for the common
// one-product-per-session case.
// ---------------------------------------------------------------------------

const RECORDING_URL = "/t/pdp-recording";

// Single source of truth for what fraction of PDP sessions get fully
// recorded — deliberately conservative, since storage/write volume is
// unbounded at 100%. Only raise this, or record outside the PDP, if
// explicitly asked for.
const PDP_RECORDING_SAMPLE_RATE = 0.15;

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

async function uploadChunk(
  sessionId: string,
  productId: string,
  chunkIndex: number,
  events: eventWithTime[],
  approxTotalSize: number,
) {
  if (events.length === 0) return;
  try {
    await fetch(RECORDING_URL, {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        product_id: productId,
        chunk_index: chunkIndex,
        approx_size: approxTotalSize,
        events,
      }),
      keepalive: true,
    });
  } catch {
    // Best-effort, same posture as pdpAnalytics.ts — losing a chunk isn't
    // worth surfacing, and the client isn't waiting on a response.
  }
}

// Call once from ProductDetail's mount effect (mirrors
// usePdpAnalyticsSession — same PDP-only scoping, so recording structurally
// cannot start from anywhere else). No-ops entirely for sessions that
// didn't sample in — @rrweb/record is never even imported for them.
export function usePdpRecording(productId: string) {
  const productIdRef = useRef(productId);
  productIdRef.current = productId;

  useEffect(() => {
    const session = getOrCreatePdpSession();
    if (!isSampledIn(session.id)) return;

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

    const flush = () => {
      if (buffer.length === 0) return;
      const toSend = buffer;
      buffer = [];
      const thisChunk = chunkIndex;
      chunkIndex += 1;
      totalSize += JSON.stringify(toSend).length;
      void uploadChunk(session.id, productIdRef.current, thisChunk, toSend, totalSize);
    };

    const startRecording = async () => {
      if (stopped) return;
      const { record } = await import("@rrweb/record");
      if (stopped) return;
      stopFn = record({
        emit(event, isCheckout) {
          buffer.push(event as eventWithTime);
          if (isCheckout) flush();
        },
        checkoutEveryNms: CHECKOUT_INTERVAL_MS,
        blockClass: "rr-block",
        maskTextClass: "rr-mask",
        maskAllInputs: true,
        recordCanvas: false,
      });
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
    // entire in-progress recording buffer, uploading nothing at all.
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onPageHide = () => flush();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      if (startTimer != null) {
        if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(startTimer);
        else window.clearTimeout(startTimer);
      }
      if (fallbackTimer != null) window.clearInterval(fallbackTimer);
      stopFn?.();
      flush();
    };
    // Deliberately empty — recording spans the whole session (however many
    // products get visited), not restarted per product; productIdRef keeps
    // uploaded chunks attributed to whichever product is current.
  }, []);
}
