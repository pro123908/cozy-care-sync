import * as Sentry from "https://esm.sh/@sentry/deno@10.68.0";

// Shared by every edge function that wants crash reporting — no-ops
// safely if SENTRY_DSN isn't set as a function secret (e.g. before a
// Sentry project exists yet), same pattern as the admin-app/storefront
// frontend Sentry setup.
//
// Deno edge functions have no framework-level auto-instrumentation the way
// Next.js's onRequestError does, so unlike the frontend setup this only
// catches what's explicitly wrapped — see captureError() below, called
// from each function's own catch blocks.
let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  initialized = true;
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  initSentry();
  if (!Deno.env.get("SENTRY_DSN")) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
