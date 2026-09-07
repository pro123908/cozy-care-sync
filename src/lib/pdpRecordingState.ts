// Tiny, dependency-free module split out of pdpRecording.ts specifically so
// nothing that must stay eager (App.tsx's mount effect, ProductDetail's
// active-product reporting) has a static import edge to pdpRecording.ts
// itself — that file's own import("@rrweb/record") is what needs to stay
// unreachable from any eagerly-loaded chunk. Merely gating the import() call
// at runtime wasn't enough while the FILE containing it was still statically
// imported eagerly: Vite/Rollup injects a <link rel="modulepreload"> for a
// dynamic import's target chunk based purely on static reachability from the
// entry graph, with no regard for the runtime condition wrapping it — so
// vendor-rrweb (~23KB gzipped) was loading for every visitor on every page,
// sampled in or not, until pdpRecording.ts itself became reachable only via
// a dynamic import gated on isSampledInForRecording() below, which lives
// here instead.
import { useEffect } from "react";
import { getOrCreatePdpSession } from "./pdpAnalytics";

const SAMPLE_DECISION_KEY = "wcm_pdp_recording_sample";
// Single source of truth for what fraction of sessions get fully recorded.
// Set to 1.0 (100%) at the user's explicit request while actively testing
// this feature — dial this back down once it's trusted, since storage/write
// volume is unbounded at 100% for real production traffic, now across every
// page rather than just PDPs.
const PDP_RECORDING_SAMPLE_RATE = 1;

type SampleDecision = { sessionId: string; sampledIn: boolean };

// Tied to the same session_id as pdpAnalytics.ts and decided once per
// session (not re-rolled on every PDP page within one visit).
export function isSampledInForRecording(sessionId: string): boolean {
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

let currentPdpProductId: string | null = null;

export function setActivePdpProduct(productId: string | null) {
  currentPdpProductId = productId;
}

export function getActivePdpProduct(): string | null {
  return currentPdpProductId;
}

// Call once from the app root (see src/wcm/App.tsx). The sampling check
// happens here, in this eager-safe module, specifically so a sampled-out
// session never triggers the dynamic import below at all — see the file
// header for why that matters more than it sounds like it should.
export function useSiteRecording() {
  useEffect(() => {
    const session = getOrCreatePdpSession();
    if (!isSampledInForRecording(session.id)) return;

    let cancelled = false;
    let stopFn: (() => void) | undefined;
    void import("./pdpRecording").then(({ startSiteRecording }) => {
      if (cancelled) return;
      stopFn = startSiteRecording(session);
    });

    return () => {
      cancelled = true;
      stopFn?.();
    };
  }, []);
}
