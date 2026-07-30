declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

// Defines window.gtag as a thin queue (dataLayer.push) immediately — cheap
// and synchronous, no network cost — so every gaEvent() call below queues
// safely even before the real gtag.js script has loaded. That's how gtag.js
// is designed to work: the queue is what makes lazy-loading the actual
// script (see loadGaScript) safe without dropping early events like the
// first product page's view_item.
function ensureGtagShim() {
  if (typeof window === "undefined" || window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
}

let scriptLoaded = false;
function loadGaScript() {
  if (scriptLoaded || !GA_MEASUREMENT_ID || typeof document === "undefined") return;
  scriptLoaded = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

// Loads the real gtag.js network request after first interaction (or a
// short idle fallback), not on initial page load — keeps it off the
// critical rendering path alongside Sentry/the PWA service worker already
// running here. Call once from main.tsx.
export function initGaLazy() {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return;
  ensureGtagShim();
  window.gtag!("js", new Date());
  // App.tsx sends its own page_view on every SPA route change, so this
  // suppresses gtag's automatic one on config to avoid double-counting the
  // first view. debug_mode routes events into GA4's DebugView report
  // (near-instant, full detail) instead of/in addition to Realtime, which
  // has more processing lag and is easy to misread as "nothing arrived" —
  // dev-only, never set in production so it doesn't skew real reports.
  window.gtag!("config", GA_MEASUREMENT_ID, {
    send_page_view: false,
    ...(import.meta.env.DEV ? { debug_mode: true } : {}),
  });

  const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"];
  let fired = false;
  const trigger = () => {
    if (fired) return;
    fired = true;
    events.forEach((e) => window.removeEventListener(e, trigger));
    clearTimeout(fallback);
    loadGaScript();
  };
  events.forEach((e) => window.addEventListener(e, trigger, { once: true, passive: true }));
  const fallback = window.setTimeout(trigger, 4000);
}

export function gaEvent(name: string, params?: Record<string, unknown>) {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return;
  ensureGtagShim();
  window.gtag!("event", name, params);
}
