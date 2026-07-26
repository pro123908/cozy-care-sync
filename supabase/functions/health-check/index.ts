// Synthetic monitor for wellcaremart.pk, triggered on a schedule by pg_cron
// (see supabase/migrations/*_health_check_cron.sql) — built in response to
// the SEO crawlability middleware silently regressing to broken for over a
// day before anyone noticed (2026-07-26). Checks the exact failure mode
// that bug had (bots getting the empty SPA shell instead of rendered
// content) plus a couple of other cheap, high-signal checks.
//
// Alerting is deliberately two-channel: WhatsApp free-form messages to the
// owner's own number only deliver within an open 24h session window (no
// approved "site down" template exists, and getting one approved takes
// days) — sending one is attempted as a fast, best-effort channel, but
// email via Resend (already used for order notifications, no session-window
// restriction) is the channel actually guaranteed to arrive. A monitoring
// system whose only alert channel can silently fail to deliver would repeat
// the exact class of bug it exists to catch.
import { captureError } from "../_shared/sentry.ts";

const HEALTH_CHECK_SECRET = Deno.env.get("HEALTH_CHECK_SECRET") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const HEALTH_ALERT_EMAIL = Deno.env.get("HEALTH_ALERT_EMAIL") || Deno.env.get("ORDER_NOTIFY_EMAIL") || "";
const ORDER_NOTIFY_FROM = Deno.env.get("ORDER_NOTIFY_FROM") || "Well Care Mart <onboarding@resend.dev>";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
const WHATSAPP_GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v21.0";
const HEALTH_ALERT_WHATSAPP_PHONE = Deno.env.get("HEALTH_ALERT_WHATSAPP_PHONE") || "";

type CheckResult = { name: string; ok: boolean; detail: string };

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// The exact regression this whole function exists to catch: a non-JS
// fetcher (bot UA, no Sec-Fetch-Mode header — see wellcare-mart-app's
// middleware.ts) must get server-rendered product content, not the bare
// SPA shell.
async function checkStorefrontRendersForBots(): Promise<CheckResult> {
  const name = "storefront renders for bots";
  try {
    const res = await fetchWithTimeout("https://wellcaremart.pk/", {
      headers: { "User-Agent": "WellCareHealthCheck/1.0" },
    });
    if (!res.ok) return { name, ok: false, detail: `HTTP ${res.status}` };
    const body = await res.text();
    if (body.includes('<div id="root"></div>')) {
      return { name, ok: false, detail: "got the empty SPA shell instead of rendered content (middleware not running?)" };
    }
    if (!body.includes("/products/")) {
      return { name, ok: false, detail: "response has no product links" };
    }
    return { name, ok: true, detail: "ok" };
  } catch (err) {
    return { name, ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkSitemap(): Promise<CheckResult> {
  const name = "sitemap.xml";
  try {
    const res = await fetchWithTimeout("https://wellcaremart.pk/sitemap.xml", {
      headers: { "User-Agent": "WellCareHealthCheck/1.0" },
    });
    if (!res.ok) return { name, ok: false, detail: `HTTP ${res.status}` };
    const body = await res.text();
    if (!body.includes("<urlset") || !body.includes("<loc>")) {
      return { name, ok: false, detail: "response isn't a valid sitemap" };
    }
    return { name, ok: true, detail: "ok" };
  } catch (err) {
    return { name, ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkAdminPanelReachable(): Promise<CheckResult> {
  const name = "admin panel reachable";
  try {
    const res = await fetchWithTimeout("https://admin.wellcaremart.pk/", { redirect: "manual" });
    // Redirect to /login counts as reachable — only a 5xx or network failure
    // means something's actually broken.
    if (res.status >= 500) return { name, ok: false, detail: `HTTP ${res.status}` };
    return { name, ok: true, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { name, ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

function toWhatsAppNumber(rawPhone: string): string | null {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return null;
  let national = digits;
  if (national.startsWith("0")) national = national.slice(1);
  if (!national.startsWith("92")) national = `92${national}`;
  return national;
}

async function sendWhatsAppAlert(text: string): Promise<void> {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN || !HEALTH_ALERT_WHATSAPP_PHONE) return;
  const to = toWhatsAppNumber(HEALTH_ALERT_WHATSAPP_PHONE);
  if (!to) return;
  try {
    await fetch(`https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
    });
    // Best-effort only — a failure here (most likely: no open 24h session
    // window) must not prevent the guaranteed email alert below from firing.
  } catch (err) {
    console.error("[health-check] whatsapp alert failed", err);
  }
}

async function sendEmailAlert(subject: string, text: string): Promise<void> {
  if (!RESEND_API_KEY || !HEALTH_ALERT_EMAIL) {
    console.error("[health-check] cannot send email alert - missing RESEND_API_KEY or HEALTH_ALERT_EMAIL/ORDER_NOTIFY_EMAIL");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: ORDER_NOTIFY_FROM,
        to: HEALTH_ALERT_EMAIL.split(",").map((e) => e.trim()).filter(Boolean),
        subject,
        text,
      }),
    });
    if (!res.ok) {
      console.error("[health-check] email alert send failed", { status: res.status, body: await res.text().catch(() => "") });
    }
  } catch (err) {
    console.error("[health-check] email alert send threw", err);
  }
}

Deno.serve(
  {
    onError: (err) => {
      captureError(err);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    },
  },
  async (req: Request) => {
    if (!HEALTH_CHECK_SECRET || req.headers.get("x-health-check-secret") !== HEALTH_CHECK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const results = await Promise.all([checkStorefrontRendersForBots(), checkSitemap(), checkAdminPanelReachable()]);
    const failures = results.filter((r) => !r.ok);

    if (failures.length > 0) {
      const summary = failures.map((f) => `- ${f.name}: ${f.detail}`).join("\n");
      const text = `⚠️ Well Care Mart health check failed (${new Date().toISOString()})\n\n${summary}`;
      await Promise.all([sendWhatsAppAlert(text), sendEmailAlert(`⚠️ Well Care Mart health check failed`, text)]);
    }

    return new Response(JSON.stringify({ ok: failures.length === 0, results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
);
