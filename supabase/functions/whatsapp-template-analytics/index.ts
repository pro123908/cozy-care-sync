import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { captureError } from "../_shared/sentry.ts";

// Called server-to-server by admin-app's WhatsApp Messages page to show
// Meta's own per-template performance (sent/delivered/read/clicked, daily) —
// proxies the WhatsApp Business Management API's template_analytics field,
// since WHATSAPP_ACCESS_TOKEN only exists as a write-only secret here, not
// in admin-app's environment. Same shared-secret gate as the sibling
// whatsapp-pricing-analytics function.
//
// template_analytics wants numeric HSM template IDs, not names, and caps at
// 10 ids per request — so this resolves the small, fixed set of template
// *names* this project actually sends (order confirmation, shipment,
// feedback on-time/late) against message_templates first, then fetches
// analytics for whichever of those currently exist on this WABA. A
// name that isn't found (not yet created/approved) is just omitted rather
// than erroring the whole request.
//
// Field-expansion order follows whatsapp-pricing-analytics's confirmed-working
// pattern (temporal params, then granularity, then metric_types, then the
// remaining filter param) — that function documented a real gotcha where
// Graph API silently drops the whole field if metric_types/dimensions are
// ordered wrong, so template_ids is kept last here defensively.
//
// Fetching fresh from Meta takes ~7-8s (up to 4 templates * 2 pages each,
// confirmed live 2026-07-23) — too slow to re-run on every WhatsApp
// Messages page load. Cached in whatsapp_template_analytics_cache (a
// single-row table) for CACHE_TTL_MS; a request within that window returns
// the cached payload with zero Meta calls. The requested start/end aren't
// part of the cache key — this feature only ever asks for "last 30 days
// from now", so a few minutes of drift in exactly where that window starts
// is immaterial, and caching by exact timestamp would never hit anyway.

const SHIPMENT_NOTIFY_SECRET = Deno.env.get("SHIPMENT_NOTIFY_SECRET") || "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
const WHATSAPP_WABA_ID = Deno.env.get("WHATSAPP_WABA_ID") || "";
const WHATSAPP_GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v21.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CACHE_TTL_MS = 30 * 60 * 1000;

// Kept in step with the template-name env vars used across place-order,
// send-shipment-notification, and send-feedback-request.
const TRACKED_TEMPLATE_NAMES = [
  Deno.env.get("WHATSAPP_TEMPLATE_NAME") || "order_confirmation_request",
  Deno.env.get("WHATSAPP_SHIPMENT_TEMPLATE_NAME") || "",
  Deno.env.get("WHATSAPP_FEEDBACK_TEMPLATE_ONTIME") || "delivery_feedback_ontime",
  Deno.env.get("WHATSAPP_FEEDBACK_TEMPLATE_LATE") || "delivery_feedback_late",
].filter(Boolean);

type RequestBody = {
  start: number; // unix seconds
  end: number; // unix seconds
  granularity?: "DAILY";
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

  const dbClient =
    SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;

  if (dbClient) {
    const { data: cached } = await dbClient
      .from("whatsapp_template_analytics_cache")
      .select("payload, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (cached && Date.now() - new Date(cached.updated_at).getTime() < CACHE_TTL_MS) {
      return json(cached.payload);
    }
  }

  if (TRACKED_TEMPLATE_NAMES.length === 0) {
    return json({ templates: [], template_analytics: null });
  }

  const listUrl =
    `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${WHATSAPP_WABA_ID}/message_templates` +
    `?fields=id,name,status&limit=250&access_token=${WHATSAPP_ACCESS_TOKEN}`;

  let tracked: { id: string; name: string; status: string }[];
  try {
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();
    if (!listRes.ok) {
      console.error("[whatsapp-template-analytics] template list failed", { status: listRes.status, listData });
      return json({ error: "Meta template list failed", detail: listData }, 502);
    }
    const all: { id: string; name: string; status: string }[] = listData.data ?? [];
    tracked = all.filter((t) => TRACKED_TEMPLATE_NAMES.includes(t.name)).slice(0, 10);
  } catch (err) {
    console.error("[whatsapp-template-analytics] template list threw", err);
    return json({ error: "Request threw" }, 500);
  }

  if (tracked.length === 0) {
    return json({ templates: [], template_analytics: null });
  }

  // Meta paginates data_points at ~25/page, hard-capped regardless of a
  // `limit` param (confirmed live). Querying all templates in one
  // template_ids([...]) array over a 30-day window needs ~120 points = 5+
  // pages — and following Meta's own `paging.next` cursor chain that far
  // reproducibly 400s with an OAuthException on the 3rd hop (confirmed live
  // 2026-07-23, page 1 and 2 always succeed, page 3 always fails — root
  // cause not identified, but consistent enough to just design around).
  // Querying ONE template at a time keeps each chain to ~30 points = at
  // most 2 pages, which never reaches the broken 3rd hop.
  //
  // The response shape is inconsistent across hops in a way that isn't
  // simply "first hop vs rest" — confirmed live 2026-07-23 that at least 3
  // distinct shapes occur: (a) the first request (a node fields-expansion
  // call, `?fields=template_analytics...`) nests under a
  // `template_analytics: { data: [{data_points}], paging }` wrapper keyed
  // by the field name; (b) some `paging.next` hops (direct edge calls,
  // `/{id}/template_analytics?...`) return `{ data: [{data_points}], paging
  // }` — grouped like (a) but WITHOUT the template_analytics wrapper; (c)
  // other hops return `{ data: [<point>, <point>, ...], paging }` fully
  // flat, no grouping at all. Rather than branch on which hop number this
  // is, unwrap the outer wrapper if present, then inspect the shape of the
  // first array element to tell grouped from flat.
  function extractPoints(data: Record<string, unknown>): { points: Record<string, unknown>[]; next: string | null } {
    const container = (data.template_analytics ?? data) as {
      data?: Record<string, unknown>[];
      paging?: { next?: string };
    };
    const arr = container.data ?? [];
    const first = arr[0];
    const isGrouped = !!first && Array.isArray((first as { data_points?: unknown }).data_points);
    const points = isGrouped
      ? arr.flatMap((group) => (group as { data_points?: Record<string, unknown>[] }).data_points ?? [])
      : arr;
    return { points, next: container.paging?.next ?? null };
  }

  async function fetchTemplatePoints(templateId: string): Promise<Record<string, unknown>[]> {
    const fields =
      `template_analytics.start(${start}).end(${end}).granularity(${granularity})` +
      `.metric_types(["SENT","DELIVERED","READ","CLICKED"]).template_ids(["${templateId}"])`;
    let nextUrl: string | null =
      `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${WHATSAPP_WABA_ID}?fields=${encodeURIComponent(fields)}&access_token=${WHATSAPP_ACCESS_TOKEN}`;
    const points: Record<string, unknown>[] = [];
    let hops = 0;
    while (nextUrl && hops < 5) {
      hops += 1;
      const res = await fetch(nextUrl);
      const data = await res.json();
      if (!res.ok) {
        console.error("[whatsapp-template-analytics] analytics call failed", { templateId, hop: hops, status: res.status, data });
        throw new Error(`Meta analytics call failed for template ${templateId}: ${data?.error?.message ?? res.status}`);
      }
      const extracted = extractPoints(data);
      points.push(...extracted.points);
      nextUrl = extracted.next;
    }
    return points;
  }

  try {
    const perTemplate = await Promise.all(tracked.map((t) => fetchTemplatePoints(t.id)));
    const dataPoints = perTemplate.flat();
    const result = {
      templates: tracked,
      template_analytics: { data: [{ granularity, product_type: "cloud_api", data_points: dataPoints }] },
    };
    if (dbClient) {
      const { error: cacheError } = await dbClient
        .from("whatsapp_template_analytics_cache")
        .upsert({ id: 1, payload: result, updated_at: new Date().toISOString() });
      if (cacheError) console.error("[whatsapp-template-analytics] cache write failed", cacheError.message);
    }
    return json(result);
  } catch (err) {
    console.error("[whatsapp-template-analytics] analytics threw", err);
    return json({ error: err instanceof Error ? err.message : "Request threw" }, 500);
  }
});
