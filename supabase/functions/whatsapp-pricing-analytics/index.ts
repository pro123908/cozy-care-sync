// Called server-to-server by admin-app's WhatsApp Messages page to show
// Meta's own real billed cost (not our own best-effort estimate computed
// from whatsapp_message_log) — proxies the WhatsApp Business Management
// API's pricing_analytics field, since WHATSAPP_ACCESS_TOKEN only exists as
// a write-only secret here, not in admin-app's environment.
//
// Read-only and free to call (Meta doesn't charge for querying analytics),
// but it exposes real business spend/volume data, so it's still gated by
// the same shared-secret header used by this project's paid-send functions
// rather than left open.
//
// Gotcha found 2026-07-20: Graph API silently drops the whole pricing_analytics
// field (no error — response just omits it) if .metric_types(...) appears
// BEFORE .dimensions(...) in the field-expansion string. Swapping the order
// fixes it. Cost `cost` values come back in the WABA's own currency (USD for
// this account, confirmed via a separate `?fields=currency` call — NOT PKR,
// despite the business being Pakistan-based).

const SHIPMENT_NOTIFY_SECRET = Deno.env.get("SHIPMENT_NOTIFY_SECRET") || "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
const WHATSAPP_WABA_ID = Deno.env.get("WHATSAPP_WABA_ID") || "";
const WHATSAPP_GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v21.0";

type RequestBody = {
  start: number; // unix seconds
  end: number; // unix seconds
  granularity?: "DAILY" | "MONTHLY" | "HALF_HOUR";
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!SHIPMENT_NOTIFY_SECRET || req.headers.get("x-shipment-notify-secret") !== SHIPMENT_NOTIFY_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_WABA_ID) {
    return json({ error: "WhatsApp analytics not configured" }, 500);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { start, end, granularity = "DAILY" } = body;
  if (!start || !end) {
    return json({ error: "start and end (unix seconds) are required" }, 400);
  }

  const fields = `pricing_analytics.start(${start}).end(${end}).granularity(${granularity}).dimensions(["PRICING_CATEGORY"]).metric_types(["COST","VOLUME"])`;
  const url = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${WHATSAPP_WABA_ID}?fields=${encodeURIComponent(fields)}&access_token=${WHATSAPP_ACCESS_TOKEN}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      console.error("[whatsapp-pricing-analytics] Meta call failed", { status: res.status, data });
      return json({ error: "Meta API call failed", detail: data }, 502);
    }
    return json({ pricing_analytics: data.pricing_analytics ?? null, currency: "USD" });
  } catch (err) {
    console.error("[whatsapp-pricing-analytics] threw", err);
    return json({ error: "Request threw" }, 500);
  }
});
