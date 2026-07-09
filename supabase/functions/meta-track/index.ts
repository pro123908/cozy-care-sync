import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const META_PIXEL_ID = Deno.env.get("META_PIXEL_ID") || "2002828427034307";
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || "";
const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v20.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const logClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function logMetaEvent(row: {
  event_name: string;
  event_id?: string | null;
  status: "sent" | "failed" | "skipped";
  reason?: string | null;
  value?: number | null;
  currency?: string | null;
  num_items?: number | null;
  content_ids?: string[] | null;
  has_email?: boolean;
  has_phone?: boolean;
  event_source_url?: string | null;
  fbtrace_id?: string | null;
  user_agent?: string | null;
  ip_address?: string | null;
}) {
  const { error } = await logClient.from("meta_events").insert({ source: "client-event", ...row });
  if (error) console.error("[meta-capi] failed to log event", error);
}

const ALLOWED_EVENTS = new Set([
  "PageView",
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Purchase",
  "Search",
  "AddToWishlist",
  "Contact",
  "CompleteRegistration",
]);

type Body = {
  event_name?: string;
  event_id?: string;
  event_source_url?: string;
  custom_data?: Record<string, unknown>;
  user_data?: {
    email?: string;
    phone?: string;
    fbc?: string;
    fbp?: string;
  };
};

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function summarizeMetaResponse(metaResponse: unknown) {
  if (!metaResponse || typeof metaResponse !== "object") return { raw: metaResponse };
  const response = metaResponse as Record<string, unknown>;
  return {
    events_received: response.events_received,
    messages: response.messages,
    fbtrace_id: response.fbtrace_id,
    raw: metaResponse,
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  const eventName = (body.event_name || "").trim();
  if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
    console.info("[meta-capi] unsupported event", {
      eventName,
      keys: Object.keys(body.custom_data || {}),
    });
    return json({ error: "Unsupported event_name" }, 400, origin);
  }

  const customData = body.custom_data || {};
  console.info("[meta-capi] incoming event", {
    eventName,
    eventId: body.event_id || null,
    contentIds: Array.isArray(customData.content_ids) ? customData.content_ids : [],
    numItems: typeof customData.num_items === "number" ? customData.num_items : null,
    value: typeof customData.value === "number" ? customData.value : null,
    currency: typeof customData.currency === "string" ? customData.currency : null,
    hasUserEmail: Boolean(body.user_data?.email),
    hasUserPhone: Boolean(body.user_data?.phone),
    hasFbc: Boolean(body.user_data?.fbc),
    hasFbp: Boolean(body.user_data?.fbp),
  });

  const eventValue = typeof customData.value === "number" ? customData.value : null;
  const eventCurrency = typeof customData.currency === "string" ? customData.currency : null;
  const eventNumItems = typeof customData.num_items === "number" ? customData.num_items : null;
  const eventContentIds = Array.isArray(customData.content_ids)
    ? customData.content_ids.map(String)
    : null;
  const clientIp = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "";
  const userAgent = req.headers.get("user-agent") || "";

  if (!META_ACCESS_TOKEN || !META_PIXEL_ID) {
    console.info("[meta-capi] missing META_ACCESS_TOKEN or META_PIXEL_ID - skipping event", {
      eventName,
    });
    await logMetaEvent({
      event_name: eventName,
      event_id: body.event_id || null,
      status: "skipped",
      reason: "Missing META_ACCESS_TOKEN or META_PIXEL_ID",
      value: eventValue,
      currency: eventCurrency,
      num_items: eventNumItems,
      content_ids: eventContentIds,
      has_email: Boolean(body.user_data?.email),
      has_phone: Boolean(body.user_data?.phone),
      event_source_url: body.event_source_url?.trim() || origin,
      user_agent: userAgent,
      ip_address: clientIp,
    });
    return json({ ok: true, skipped: true }, 200, origin);
  }

  const eventSourceUrl = body.event_source_url?.trim() || origin || req.url;

  const userData: Record<string, unknown> = {
    client_user_agent: userAgent,
    client_ip_address: clientIp,
  };

  const email = body.user_data?.email ? normalizeEmail(body.user_data.email) : "";
  const phone = body.user_data?.phone ? normalizePhone(body.user_data.phone) : "";
  const fbc = body.user_data?.fbc?.trim() || "";
  const fbp = body.user_data?.fbp?.trim() || "";

  if (email) userData.em = [await sha256Hex(email)];
  if (phone) userData.ph = [await sha256Hex(phone)];
  if (fbc) userData.fbc = fbc;
  if (fbp) userData.fbp = fbp;

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        ...(body.event_id ? { event_id: body.event_id } : {}),
        action_source: "website",
        event_source_url: eventSourceUrl,
        user_data: userData,
        custom_data: body.custom_data || {},
      },
    ],
  };

  const endpoint = `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[meta-capi] event failed", { eventName, status: res.status, response: txt });
    await logMetaEvent({
      event_name: eventName,
      event_id: body.event_id || null,
      status: "failed",
      reason: `HTTP ${res.status}: ${txt.slice(0, 500)}`,
      value: eventValue,
      currency: eventCurrency,
      num_items: eventNumItems,
      content_ids: eventContentIds,
      has_email: Boolean(body.user_data?.email),
      has_phone: Boolean(body.user_data?.phone),
      event_source_url: eventSourceUrl,
      user_agent: userAgent,
      ip_address: clientIp,
    });
    return json({ ok: false, error: "Failed to send event" }, 502, origin);
  }

  const metaResponse = await res.json().catch(() => null);
  const responseSummary = summarizeMetaResponse(metaResponse) as { fbtrace_id?: string };
  console.info("[meta-capi] meta response summary", {
    eventName,
    eventId: body.event_id || null,
    summary: responseSummary,
  });
  console.info("[meta-capi] event sent", {
    eventName,
    eventId: body.event_id || null,
    value: eventValue,
    numItems: eventNumItems,
    metaResponse,
  });
  await logMetaEvent({
    event_name: eventName,
    event_id: body.event_id || null,
    status: "sent",
    value: eventValue,
    currency: eventCurrency,
    num_items: eventNumItems,
    content_ids: eventContentIds,
    has_email: Boolean(body.user_data?.email),
    has_phone: Boolean(body.user_data?.phone),
    event_source_url: eventSourceUrl,
    fbtrace_id: responseSummary.fbtrace_id || null,
    user_agent: userAgent,
    ip_address: clientIp,
  });
  return json({ ok: true }, 200, origin);
});
