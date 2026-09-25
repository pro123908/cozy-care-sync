import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { resolveGeo } from "../_shared/geo.ts";
import { logWhatsAppMessage } from "../_shared/whatsappLog.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderItem = { id: string; qty: number; size?: string };

type ShipDetails = {
  name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  landmark: string;
};

type RequestBody = {
  items: OrderItem[];
  ship: ShipDetails;
  pay: string;
  promo_code?: string;
  meta?: { fbc?: string; fbp?: string; visitor_id?: string };
};

type SizeOption = { size: string; price: number };
type VariantOption = { name: string; price: number };
type ProductRow = {
  id: string;
  name: string;
  cat: string;
  price: number;
  active: boolean;
  stock: string;
  block_when_out_of_stock?: boolean;
  size_options?: SizeOption[] | null;
  variant_options?: VariantOption[] | null;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FREE_SHIPPING_THRESHOLD = 2000;
const FREE_SHIPPING_THRESHOLD_OTHER_CITIES = 5000; // Rs 2,000 was tried 2026-09-21 and reverted
const SHIPPING_COST = 250;
const MAX_QTY_PER_PRODUCT = 5;
// Wheelchairs and commode/shower chairs are delivered in Karachi only —
// mirror of KARACHI_ONLY_CATEGORIES in the storefront's src/wcm/data.ts.
const KARACHI_ONLY_CATEGORIES = new Set(["wheelchairs", "camote-chairs"]);
// "Order over Rs 5,000 -> Rs 200 off next order" reward. Deliberately a
// separate constant from the free-delivery thresholds — they're independent
// business rules (delivery-fee waiver vs. a loyalty reward).
const REWARD_COUPON_THRESHOLD = 5000;
const REWARD_COUPON_DISCOUNT = 200;
// Bundle deals: buy both products, get a flat Rs discount, recorded on the
// order as orders.discount. Mirror of BUNDLES/computeBundles in the
// storefront's src/wcm/data.ts — keep the two lists identical.
const BUNDLES: { ids: [string, string]; discount: number }[] = [
  { ids: ["gluco-002", "strip-003"], discount: 250 },
  { ids: ["gluco-003", "strip-003"], discount: 250 },
  { ids: ["gluco-001", "strip-002"], discount: 250 },
  { ids: ["gluco-004", "strip-007"], discount: 200 },
  { ids: ["bd-012", "neb-010"], discount: 200 },
  { ids: ["bd-012", "po-002"], discount: 250 },
  { ids: ["bd-012", "wsd-002"], discount: 200 },
  { ids: ["bd-012", "oth-018"], discount: 150 },
  { ids: ["hear-002", "bd-012"], discount: 250 },
  { ids: ["ha-007", "bd-012"], discount: 250 },
  { ids: ["bp-man-003", "steth-001"], discount: 150 },
  { ids: ["bp-man-002", "steth-003"], discount: 150 },
  { ids: ["stick-001", "rub-001"], discount: 100 },
  { ids: ["mas-012", "tens-001"], discount: 300 },
  { ids: ["supp-001", "oth-002"], discount: 100 },
];

// Bundle deals end at a fixed instant — mirror of BUNDLE_DEALS_END_MS in the
// storefront's data.ts (Tue 6 Oct 2026, 11:59 PM PKT). Enforced here so the
// discount and bundle free-delivery genuinely stop; a short grace covers a
// shopper who saw the discount at checkout just before the deadline.
const BUNDLE_DEALS_END_MS = new Date("2026-10-06T23:59:59+05:00").getTime();
const BUNDLE_DEALS_GRACE_MS = 5 * 60 * 1000;

// Mix & match — mirror of MIX_MATCH_* / pairMixMatch in the storefront's
// data.ts. Any two different products from the pool, combined >= Rs 2,500,
// get a tiered discount; fixed BUNDLES are allocated first.
const MIX_MATCH_MIN_TOTAL = 2500;
const MIX_MATCH_TIERS = [
  { min: 7000, off: 300 },
  { min: 4000, off: 200 },
  { min: 2500, off: 100 },
];
const MIX_MATCH_SET = new Set([
  "bd-012",
  "bp-dig-002",
  "bp-dig-003",
  "bp-dig-004",
  "bp-dig-005",
  "bp-dig-008",
  "bp-dig-011",
  "bp-man-007",
  "bpump-002",
  "gluco-001",
  "gluco-002",
  "gluco-003",
  "gluco-008",
  "gluco-010",
  "ha-006",
  "ha-007",
  "hear-001",
  "hear-002",
  "hear-003",
  "hear-004",
  "heat-001",
  "heat-002",
  "heat-003",
  "heat-004",
  "mas-006",
  "mas-010",
  "mas-011",
  "mas-012",
  "mas-015",
  "mass-003",
  "mass-004",
  "mass-005",
  "neb-003",
  "neb-010",
  "belt-011",
  "os-021",
  "supp-001",
  "oth-004",
  "oth-008",
  "oth-026",
  "oth-028",
  "ps-006",
  "stick-001",
  "stick-004",
  "po-002",
  "steth-007",
  "ss-014",
  "strip-002",
  "strip-003",
  "strip-004",
  "strip-007",
  "tens-001",
  "tens-002",
  "wlk-001",
  "wsd-002",
  "wsd-004",
  "wsd-005",
  "wsd-008",
  "wsm-001",
  "wsm-002",
  "wsm-003",
]);

function mixMatchDiscount(combined: number): number {
  return MIX_MATCH_TIERS.find((tier) => combined >= tier.min)?.off ?? 0;
}

function computeBundleDiscount(lines: { id: string; qty: number; unit_price: number }[]): number {
  if (Date.now() > BUNDLE_DEALS_END_MS + BUNDLE_DEALS_GRACE_MS) return 0;
  const remaining = new Map<string, number>();
  for (const l of lines) remaining.set(l.id, (remaining.get(l.id) ?? 0) + Math.max(0, Number(l.qty) || 0));
  let total = 0;
  for (const bundle of [...BUNDLES].sort((a, b) => b.discount - a.discount)) {
    const times = Math.min(...bundle.ids.map((id) => remaining.get(id) ?? 0));
    if (times <= 0) continue;
    for (const id of bundle.ids) remaining.set(id, (remaining.get(id) ?? 0) - times);
    total += bundle.discount * times;
  }
  const priceOf = new Map<string, number>();
  for (const l of lines) if (!priceOf.has(l.id)) priceOf.set(l.id, l.unit_price);
  const pool: { id: string; price: number }[] = [];
  for (const [id, qty] of remaining) {
    const price = priceOf.get(id);
    if (price == null || !MIX_MATCH_SET.has(id)) continue;
    for (let i = 0; i < qty; i++) pool.push({ id, price });
  }
  pool.sort((a, b) => b.price - a.price || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  while (pool.length > 0) {
    const unit = pool.shift()!;
    const j = pool.findIndex((other) => other.id !== unit.id && unit.price + other.price >= MIX_MATCH_MIN_TOTAL);
    if (j < 0) continue;
    const [partner] = pool.splice(j, 1);
    total += mixMatchDiscount(unit.price + partner.price);
  }
  return total;
}
const META_PIXEL_ID = Deno.env.get("META_PIXEL_ID") || "2002828427034307";
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || "";
const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v20.0";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ORDER_NOTIFY_FROM = Deno.env.get("ORDER_NOTIFY_FROM") || "Well Care Mart <onboarding@resend.dev>";
const ORDER_NOTIFY_EMAIL = Deno.env.get("ORDER_NOTIFY_EMAIL") || "";
// WhatsApp order confirmations go out via Meta's WhatsApp Cloud API (migrated
// off Twilio 2026-07-15 — the business number now lives on Cloud API, not a
// BSP). Needs: the phone number's Cloud API ID, a token with
// whatsapp_business_messaging, and the approved "order_confirmation_v2"
// utility template (cut over 2026-09-10 from the retired 8-variable
// "order_confirmation_request" — see [[project_whatsapp_order_confirmation_v2_template]]).
// Its body has 9 positional variables in this exact order: 1 order number,
// 2 total, 3 name, 4 phone, 5 address, 6 city, 7 country, 8 payment method,
// 9 products list. "Estimated delivery: 3-5 working days" and the
// Confirm/Cancel instructions line are static template text, not variables.
// The template's Confirm/Cancel quick-reply buttons have no payload set at
// creation, so the payload MUST be supplied per-send via a "button"
// component (see sendWhatsAppOrderConfirmation) — without it the
// CONFIRM:<order_code>/CANCEL:<order_code> payload whatsapp-inbound expects
// won't be there.
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
const WHATSAPP_TEMPLATE_NAME = Deno.env.get("WHATSAPP_TEMPLATE_NAME") || "order_confirmation_v2";
const WHATSAPP_TEMPLATE_LANG = Deno.env.get("WHATSAPP_TEMPLATE_LANG") || "en";
const WHATSAPP_GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v21.0";
// Left unset until a "you earned a coupon" template is submitted to and
// approved by Meta (Marketing category, like delivery_feedback_ontime/
// _late) — sends are skipped (and logged as failed, not silently) until
// then. Same gate pattern as send-address-request's WHATSAPP_ADDRESS_TEMPLATE_NAME.
const WHATSAPP_REWARD_COUPON_TEMPLATE_NAME = Deno.env.get("WHATSAPP_REWARD_COUPON_TEMPLATE_NAME") || "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function generateOrderId(): string {
  return (
    "WCM-" +
    Date.now().toString(36).toUpperCase().slice(-4) +
    Math.random().toString(36).slice(2, 5).toUpperCase()
  );
}

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

const metaEventLogClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
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
  geo_city?: string | null;
  geo_region?: string | null;
  geo_country?: string | null;
  visitor_id?: string | null;
}) {
  const { error } = await metaEventLogClient
    .from("meta_events")
    .insert({ source: "order-purchase", ...row });
  if (error) console.error("[meta-capi] failed to log event", error);
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

// Track recent Purchase values to help detect if all events have identical values
const recentPurchaseValues: number[] = [];
const MAX_RECENT = 10;

function logPurchaseValueTrend(value: number): void {
  recentPurchaseValues.push(value);
  if (recentPurchaseValues.length > MAX_RECENT) {
    recentPurchaseValues.shift();
  }
  const uniqueValues = new Set(recentPurchaseValues).size;
  if (recentPurchaseValues.length >= 3 && uniqueValues === 1) {
    console.warn("[meta-capi] Purchase values suspiciously identical", {
      recentValues: recentPurchaseValues,
      uniqueCount: uniqueValues,
      note: "All recent Purchase events have the same value. Vary test orders (different items, qty, or promos) to verify tracking.",
    });
  }
}

// Checking out with one of these phone numbers skips the live Meta Purchase
// CAPI send, so test orders placed on the real site (not just localhost)
// don't inflate the ad account's purchase/ROAS numbers. Meta attributes
// purchases by identity match (phone/email/IP via Advanced Matching), not
// just ad clicks — a test checkout with no real ad interaction can still
// land on an active campaign if the phone/email/IP has any prior signal
// Meta associates with the ads. Comma-separated so more than one test number
// can be used; override via the META_TEST_PHONE_NUMBERS env var.
const META_TEST_PHONE_NUMBERS = new Set(
  (Deno.env.get("META_TEST_PHONE_NUMBERS") || "03000000000")
    .split(",")
    .map((p) => normalizePhone(p.trim()))
    .filter(Boolean),
);

function isTestPurchase(phone: string | undefined, eventSourceUrl: string): boolean {
  if (phone && META_TEST_PHONE_NUMBERS.has(normalizePhone(phone))) return true;
  // Local dev hits this same live edge function/pixel (no staging split), so
  // a checkout run from a dev server should never count as a real purchase.
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(eventSourceUrl);
}

async function sendMetaPurchaseEvent(input: {
  orderId: string;
  total: number;
  numItems: number;
  itemIds: string[];
  email?: string;
  phone?: string;
  fbc?: string;
  fbp?: string;
  visitorId?: string;
  userAgent: string;
  clientIp: string;
  geoCity: string | null;
  geoRegion: string | null;
  geoCountry: string | null;
  eventSourceUrl: string;
}) {
  const purchaseValue = Number(input.total.toFixed(2));

  if (isTestPurchase(input.phone, input.eventSourceUrl)) {
    console.info("[meta-capi] skipping Purchase for test order", {
      eventId: input.orderId,
      eventSourceUrl: input.eventSourceUrl,
    });
    await logMetaEvent({
      event_name: "Purchase",
      event_id: input.orderId,
      status: "skipped",
      reason: "Test order (test phone number or localhost origin)",
      value: purchaseValue,
      currency: "PKR",
      num_items: input.numItems,
      content_ids: input.itemIds,
      has_email: Boolean(input.email),
      has_phone: Boolean(input.phone),
      event_source_url: input.eventSourceUrl,
      user_agent: input.userAgent,
      ip_address: input.clientIp,
      visitor_id: input.visitorId || null,
      geo_city: input.geoCity,
      geo_region: input.geoRegion,
      geo_country: input.geoCountry,
    });
    return;
  }

  if (!Number.isFinite(purchaseValue) || purchaseValue <= 0) {
    console.warn("[meta-capi] skipping Purchase with invalid value", {
      eventName: "Purchase",
      eventId: input.orderId,
      value: purchaseValue,
    });
    await logMetaEvent({
      event_name: "Purchase",
      event_id: input.orderId,
      status: "skipped",
      reason: `Invalid value: ${purchaseValue}`,
      value: purchaseValue,
      currency: "PKR",
      user_agent: input.userAgent,
      ip_address: input.clientIp,
      visitor_id: input.visitorId || null,
      geo_city: input.geoCity,
      geo_region: input.geoRegion,
      geo_country: input.geoCountry,
    });
    return;
  }

  if (!Array.isArray(input.itemIds) || input.itemIds.length === 0) {
    console.warn("[meta-capi] skipping Purchase with empty content_ids", {
      eventName: "Purchase",
      eventId: input.orderId,
    });
    await logMetaEvent({
      event_name: "Purchase",
      event_id: input.orderId,
      status: "skipped",
      reason: "Empty content_ids",
      value: purchaseValue,
      currency: "PKR",
      user_agent: input.userAgent,
      ip_address: input.clientIp,
      visitor_id: input.visitorId || null,
      geo_city: input.geoCity,
      geo_region: input.geoRegion,
      geo_country: input.geoCountry,
    });
    return;
  }

  if (!Number.isFinite(input.numItems) || input.numItems < 1) {
    console.warn("[meta-capi] skipping Purchase with invalid num_items", {
      eventName: "Purchase",
      eventId: input.orderId,
      numItems: input.numItems,
    });
    await logMetaEvent({
      event_name: "Purchase",
      event_id: input.orderId,
      status: "skipped",
      reason: `Invalid num_items: ${input.numItems}`,
      value: purchaseValue,
      currency: "PKR",
      content_ids: input.itemIds,
      user_agent: input.userAgent,
      ip_address: input.clientIp,
      visitor_id: input.visitorId || null,
      geo_city: input.geoCity,
      geo_region: input.geoRegion,
      geo_country: input.geoCountry,
    });
    return;
  }

  console.info("[meta-capi] incoming event", {
    eventName: "Purchase",
    eventId: input.orderId,
    contentIds: input.itemIds,
    numItems: input.numItems,
    value: purchaseValue,
    currency: "PKR",
    hasUserEmail: Boolean(input.email),
    hasUserPhone: Boolean(input.phone),
  });

  logPurchaseValueTrend(purchaseValue);

  if (!META_ACCESS_TOKEN || !META_PIXEL_ID) {
    console.info(
      "[meta-capi] missing META_ACCESS_TOKEN or META_PIXEL_ID - skipping Purchase event",
    );
    await logMetaEvent({
      event_name: "Purchase",
      event_id: input.orderId,
      status: "skipped",
      reason: "Missing META_ACCESS_TOKEN or META_PIXEL_ID",
      value: purchaseValue,
      currency: "PKR",
      num_items: input.numItems,
      content_ids: input.itemIds,
      has_email: Boolean(input.email),
      has_phone: Boolean(input.phone),
      event_source_url: input.eventSourceUrl,
      user_agent: input.userAgent,
      ip_address: input.clientIp,
      visitor_id: input.visitorId || null,
      geo_city: input.geoCity,
      geo_region: input.geoRegion,
      geo_country: input.geoCountry,
    });
    return;
  }

  const em = input.email ? normalizeEmail(input.email) : "";
  const ph = input.phone ? normalizePhone(input.phone) : "";

  const userData: Record<string, unknown> = {
    client_user_agent: input.userAgent,
    client_ip_address: input.clientIp,
  };

  if (em) userData.em = [await sha256Hex(em)];
  if (ph) userData.ph = [await sha256Hex(ph)];
  if (input.fbc) userData.fbc = input.fbc;
  if (input.fbp) userData.fbp = input.fbp;

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.orderId,
        action_source: "website",
        event_source_url: input.eventSourceUrl,
        user_data: userData,
        custom_data: {
          currency: "PKR",
          value: purchaseValue,
          content_type: "product",
          content_ids: input.itemIds,
          num_items: input.numItems,
          order_id: input.orderId,
        },
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
    console.error("[meta-capi] event failed", {
      eventName: "Purchase",
      eventId: input.orderId,
      status: res.status,
      response: txt,
    });
    await logMetaEvent({
      event_name: "Purchase",
      event_id: input.orderId,
      status: "failed",
      reason: `HTTP ${res.status}: ${txt.slice(0, 500)}`,
      value: purchaseValue,
      currency: "PKR",
      num_items: input.numItems,
      content_ids: input.itemIds,
      has_email: Boolean(input.email),
      has_phone: Boolean(input.phone),
      event_source_url: input.eventSourceUrl,
      user_agent: input.userAgent,
      ip_address: input.clientIp,
      visitor_id: input.visitorId || null,
      geo_city: input.geoCity,
      geo_region: input.geoRegion,
      geo_country: input.geoCountry,
    });
    return;
  }

  const metaResponse = await res.json().catch(() => null);
  const responseSummary = summarizeMetaResponse(metaResponse) as { fbtrace_id?: string };
  console.info("[meta-capi] meta response summary", {
    eventName: "Purchase",
    eventId: input.orderId,
    summary: responseSummary,
  });
  console.info("[meta-capi] event sent", {
    eventName: "Purchase",
    eventId: input.orderId,
    value: purchaseValue,
    numItems: input.numItems,
    metaResponse,
  });
  await logMetaEvent({
    event_name: "Purchase",
    event_id: input.orderId,
    status: "sent",
    value: purchaseValue,
    currency: "PKR",
    num_items: input.numItems,
    content_ids: input.itemIds,
    has_email: Boolean(input.email),
    has_phone: Boolean(input.phone),
    event_source_url: input.eventSourceUrl,
    fbtrace_id: responseSummary.fbtrace_id || null,
    user_agent: input.userAgent,
    ip_address: input.clientIp,
    visitor_id: input.visitorId || null,
    geo_city: input.geoCity,
    geo_region: input.geoRegion,
    geo_country: input.geoCountry,
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

async function sendOrderNotificationEmail(input: {
  orderId: string;
  ship: ShipDetails;
  pay: string;
  items: Array<{ id: string; qty: number; size?: string; unit_price: number }>;
  subtotal: number;
  shipping: number;
  total: number;
}) {
  if (!RESEND_API_KEY || !ORDER_NOTIFY_EMAIL) {
    console.info("[order-email] missing RESEND_API_KEY or ORDER_NOTIFY_EMAIL - skipping notification");
    return;
  }

  const recipients = ORDER_NOTIFY_EMAIL.split(",").map((e) => e.trim()).filter(Boolean);
  if (recipients.length === 0) return;

  // Plain-text alternative — a strong "transactional" signal that helps Gmail
  // keep this in the Primary tab (and out of Spam/Promotions) so it notifies.
  const shippingLine = input.shipping === 0 ? "Free" : `Rs ${input.shipping.toLocaleString()}`;
  const text = [
    `New order ${input.orderId}`,
    `Payment: ${input.pay}`,
    "",
    `Customer: ${input.ship.name}`,
    input.ship.email ? `${input.ship.phone} · ${input.ship.email}` : input.ship.phone,
    `${input.ship.address}, ${input.ship.city}${input.ship.landmark ? ` (${input.ship.landmark})` : ""}`,
    "",
    "Items:",
    ...input.items.map(
      (item) =>
        `- ${item.id}${item.size ? ` (${item.size})` : ""} x${item.qty}  Rs ${(item.unit_price * item.qty).toLocaleString()}`,
    ),
    "",
    `Subtotal: Rs ${input.subtotal.toLocaleString()}`,
    `Shipping: ${shippingLine}`,
    `Total: Rs ${input.total.toLocaleString()}`,
    "",
    "View in admin panel: https://wellcaremart.pk/admin/orders",
  ].join("\n");

  const rows = input.items
    .map(
      (item, i) =>
        `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#fafaf7"}">` +
        `<td style="padding:10px 12px;border-bottom:1px solid #eeece5;color:#1e293b;font-size:14px">${escapeHtml(item.id)}${item.size ? ` <span style="color:#64748b">(${escapeHtml(item.size)})</span>` : ""}</td>` +
        `<td style="padding:10px 12px;border-bottom:1px solid #eeece5;color:#475569;font-size:14px;text-align:center">x${item.qty}</td>` +
        `<td style="padding:10px 12px;border-bottom:1px solid #eeece5;color:#1e293b;font-size:14px;text-align:right;font-weight:600">Rs ${(item.unit_price * item.qty).toLocaleString()}</td></tr>`,
    )
    .join("");

  const html = `
  <div style="background:#f6f5f1;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
    <table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px -8px rgba(15,23,42,0.15)" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#0f172a;padding:20px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle">
                <img src="https://wellcaremart.pk/logo_updated.png" alt="Well Care Mart" height="32" style="height:32px;display:block" />
              </td>
              <td style="text-align:right;vertical-align:middle">
                <span style="color:#cbd5e1;font-size:13px">New order notification</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="height:4px;background:linear-gradient(90deg,#2563eb,#10b981);line-height:0;font-size:0">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:28px 28px 8px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size:20px;font-weight:700;color:#0f172a">Order ${escapeHtml(input.orderId)}</div>
                <div style="font-size:13px;color:#64748b;margin-top:2px">Payment: ${escapeHtml(input.pay)}</div>
              </td>
              <td style="text-align:right;vertical-align:top">
                <span style="display:inline-block;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px">Order placed</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 28px">
          <div style="background:#fafaf7;border:1px solid #eeece5;border-radius:12px;padding:14px 16px">
            <div style="font-size:14px;font-weight:600;color:#1e293b">${escapeHtml(input.ship.name)}</div>
            <div style="font-size:13px;color:#475569;margin-top:4px">${escapeHtml(input.ship.phone)}${input.ship.email ? ` · ${escapeHtml(input.ship.email)}` : ""}</div>
            <div style="font-size:13px;color:#475569;margin-top:4px">${escapeHtml(input.ship.address)}, ${escapeHtml(input.ship.city)}${input.ship.landmark ? ` (${escapeHtml(input.ship.landmark)})` : ""}</div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px 0">
          <table role="presentation" width="100%" style="border-collapse:collapse;border:1px solid #eeece5;border-radius:10px;overflow:hidden">
            <tr style="background:#f1efe7">
              <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase">Item</td>
              <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:center">Qty</td>
              <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:right">Total</td>
            </tr>
            ${rows}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px 28px">
          <table role="presentation" width="100%" style="background:linear-gradient(135deg,#eff6ff,#ecfdf5);border-radius:12px" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:16px 20px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#475569">
                  <tr><td style="padding:2px 0">Subtotal</td><td style="text-align:right">Rs ${input.subtotal.toLocaleString()}</td></tr>
                  <tr><td style="padding:2px 0">Shipping</td><td style="text-align:right">${input.shipping === 0 ? "Free" : `Rs ${input.shipping.toLocaleString()}`}</td></tr>
                  <tr><td style="padding:8px 0 0;font-size:16px;font-weight:700;color:#0f172a">Total</td><td style="text-align:right;padding:8px 0 0;font-size:16px;font-weight:700;color:#0f172a">Rs ${input.total.toLocaleString()}</td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px">
          <a href="https://wellcaremart.pk/admin/orders" style="display:block;text-align:center;background:linear-gradient(135deg,#2563eb,#10b981);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px;border-radius:10px">View in admin panel</a>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px;background:#fafaf7;border-top:1px solid #eeece5;text-align:center">
          <span style="font-size:12px;color:#94a3b8">Well Care Mart · You care, we deliver</span>
        </td>
      </tr>
    </table>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: ORDER_NOTIFY_FROM,
        to: recipients,
        ...(input.ship.email ? { reply_to: input.ship.email } : {}),
        subject: `New order ${input.orderId} - Rs ${input.total}`,
        text,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[order-email] send failed", { status: res.status, body: await res.text().catch(() => "") });
    }
  } catch (err) {
    console.error("[order-email] send threw", err);
  }
}

// Cloud API wants the recipient as a bare international number (digits only,
// country code included, no "+" and no "whatsapp:" prefix) — e.g. 923390104375.
function toWhatsAppNumber(rawPhone: string): string | null {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return null;
  let national = digits;
  if (national.startsWith("0")) national = national.slice(1);
  if (!national.startsWith("92")) national = `92${national}`;
  return national;
}

// WhatsApp templates can't loop over a variable-length item list, so a
// human-readable summary is built here instead of sending a per-item
// breakdown. One bullet per line (not a bare comma-joined string — that
// rendered cramped with no spacing, per user screenshot 2026-08-29) and
// capped at 3 named items so the message stays readable even for large
// orders.
function buildItemsSummary(
  items: Array<{ id: string; qty: number }>,
  productMap: Map<string, ProductRow>,
): string {
  const MAX_NAMED = 3;
  const named = items.map((item) => `${item.qty}x ${productMap.get(item.id)?.name || item.id}`);
  // Joined with " | " rather than "\n" — WhatsApp template params reject
  // new-line/tab characters at send time (Meta error 132018), which was
  // silently failing every multi-item order's confirmation until this fix.
  if (named.length <= MAX_NAMED) return named.map((n) => `• ${n}`).join(" | ");
  const remaining = named.length - MAX_NAMED;
  return `${named.slice(0, MAX_NAMED).map((n) => `• ${n}`).join(" | ")} | and ${remaining} more item${remaining === 1 ? "" : "s"}`;
}

// Business-initiated (the customer checked out on the website, not on
// WhatsApp) — outside any open customer-service window, so this must use a
// pre-approved template rather than a free-form message. order_confirmation_v2's
// approved body has 9 positional variables ({{1}}..{{9}}) in exactly this
// order: 1 order number, 2 total, 3 name, 4 phone, 5 address, 6 city,
// 7 country, 8 payment method, 9 products list. The "Estimated delivery"
// line and the Confirm/Cancel instructions are static template text, not
// variables. The template's Confirm/Cancel quick-reply buttons have no
// payload baked in at creation, so it's supplied here per-send as a
// "button" component — whatsapp-inbound's handleButtonTap expects exactly
// "CONFIRM:<order_code>" / "CANCEL:<order_code>".
async function sendWhatsAppOrderConfirmation(input: {
  phone: string;
  customerName: string;
  orderId: string;
  orderRowId: string | null;
  address: string;
  city: string;
  items: Array<{ id: string; qty: number; size?: string; unit_price: number }>;
  itemsSummary: string;
  total: number;
  pay: string;
}) {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.info("[whatsapp-confirmation] Cloud API not fully configured - skipping");
    return;
  }
  if (Deno.env.get("WHATSAPP_SEND_ENABLED") === "false") {
    console.info("[whatsapp-confirmation] Sends paused via WHATSAPP_SEND_ENABLED=false - skipping");
    return;
  }
  const to = toWhatsAppNumber(input.phone);
  if (!to) return;

  const textParam = (text: string) => ({ type: "text", text });
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: WHATSAPP_TEMPLATE_NAME,
      language: { code: WHATSAPP_TEMPLATE_LANG },
      components: [
        {
          type: "body",
          parameters: [
            textParam(input.orderId),
            textParam(input.total.toLocaleString()),
            textParam(input.customerName || "there"),
            textParam(`+${to}`),
            textParam(input.address),
            textParam(input.city),
            textParam("Pakistan"),
            textParam(input.pay),
            textParam(input.itemsSummary),
          ],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "0",
          parameters: [{ type: "payload", payload: `CONFIRM:${input.orderId}` }],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "1",
          parameters: [{ type: "payload", payload: `CANCEL:${input.orderId}` }],
        },
      ],
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[whatsapp-confirmation] send failed", { status: res.status, body: detail });
      await logWhatsAppMessage({
        orderId: input.orderRowId,
        orderCode: input.orderId,
        phone: input.phone,
        messageType: "order_confirmation",
        templateName: WHATSAPP_TEMPLATE_NAME,
        status: "failed",
        errorDetail: detail,
      });
      return;
    }
  } catch (err) {
    console.error("[whatsapp-confirmation] send threw", err);
    await logWhatsAppMessage({
      orderId: input.orderRowId,
      orderCode: input.orderId,
      phone: input.phone,
      messageType: "order_confirmation",
      templateName: WHATSAPP_TEMPLATE_NAME,
      status: "failed",
      errorDetail: String(err),
    });
    return;
  }

  await logWhatsAppMessage({
    orderId: input.orderRowId,
    orderCode: input.orderId,
    phone: input.phone,
    messageType: "order_confirmation",
    templateName: WHATSAPP_TEMPLATE_NAME,
    status: "sent",
  });
}

// Random 6-char base36 suffix, same shape as admin's /coupons create-dialog
// auto-fill (WELLCARE200-K3M9X2) so auto-issued and hand-created codes look
// consistent — see [[project_coupon_code_system]] / feedback_coupon_codes_unique_by_default.
function generateRewardCouponCode(): string {
  return `THANKYOU200-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// Issues a one-time Rs-200-off coupon for the customer's NEXT order,
// whenever this order's subtotal clears REWARD_COUPON_THRESHOLD. No
// expires_at by design — stays valid until redeemed; usage_limit: 1 is what
// caps it to a single use, not a deadline. Best-effort: called after the
// order row already exists, so a failure here must never undo or fail the
// order itself — same convention as the email/WhatsApp/Meta side-effects
// below it. Retries a couple of times on a code collision (23505 =
// unique_violation on coupons.code); anything else gives up.
// deno-lint-ignore no-explicit-any
async function issueRewardCoupon(
  serviceClient: any,
  orderId: string,
): Promise<{ code: string; discount: number } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateRewardCouponCode();
    const { error } = await serviceClient.from("coupons").insert({
      code,
      discount_type: "flat",
      discount_value: REWARD_COUPON_DISCOUNT,
      min_order_amount: 0,
      usage_limit: 1,
      active: true,
      note: `Auto-reward: order ${orderId} was over Rs ${REWARD_COUPON_THRESHOLD}`,
    });
    if (!error) return { code, discount: REWARD_COUPON_DISCOUNT };
    if (error.code !== "23505") {
      console.error("[reward-coupon] insert failed", error);
      return null;
    }
  }
  console.error("[reward-coupon] exhausted retries generating a unique code");
  return null;
}

// Same shape/gating as sendWhatsAppOrderConfirmation, but for the "you
// earned a coupon" message. WHATSAPP_REWARD_COUPON_TEMPLATE_NAME is unset
// until that template is approved by Meta — see its declaration above.
// Expected approved body (Marketing category), 3 variables in this order:
// 1 name, 2 order total, 3 coupon code. No expiry mention in the message —
// the coupon still expires server-side (REWARD_COUPON_VALID_DAYS), just not
// advertised to the customer.
async function sendWhatsAppRewardCoupon(input: {
  phone: string;
  customerName: string;
  orderId: string;
  orderRowId: string | null;
  total: number;
  coupon: { code: string; discount: number };
}) {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN || !WHATSAPP_REWARD_COUPON_TEMPLATE_NAME) {
    console.info("[whatsapp-reward-coupon] template not configured yet - skipping send");
    return;
  }
  if (Deno.env.get("WHATSAPP_SEND_ENABLED") === "false") {
    console.info("[whatsapp-reward-coupon] Sends paused via WHATSAPP_SEND_ENABLED=false - skipping");
    return;
  }
  const to = toWhatsAppNumber(input.phone);
  if (!to) return;

  const textParam = (text: string) => ({ type: "text", text });
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: WHATSAPP_REWARD_COUPON_TEMPLATE_NAME,
      language: { code: WHATSAPP_TEMPLATE_LANG },
      components: [
        {
          type: "body",
          parameters: [
            textParam(input.customerName || "there"),
            textParam(input.total.toLocaleString()),
            textParam(input.coupon.code),
          ],
        },
      ],
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[whatsapp-reward-coupon] send failed", { status: res.status, body: detail });
      await logWhatsAppMessage({
        orderId: input.orderRowId,
        orderCode: input.orderId,
        phone: input.phone,
        messageType: "reward_coupon",
        templateName: WHATSAPP_REWARD_COUPON_TEMPLATE_NAME,
        status: "failed",
        errorDetail: detail,
      });
      return;
    }
  } catch (err) {
    console.error("[whatsapp-reward-coupon] send threw", err);
    await logWhatsAppMessage({
      orderId: input.orderRowId,
      orderCode: input.orderId,
      phone: input.phone,
      messageType: "reward_coupon",
      templateName: WHATSAPP_REWARD_COUPON_TEMPLATE_NAME,
      status: "failed",
      errorDetail: String(err),
    });
    return;
  }

  await logWhatsAppMessage({
    orderId: input.orderRowId,
    orderCode: input.orderId,
    phone: input.phone,
    messageType: "reward_coupon",
    templateName: WHATSAPP_REWARD_COUPON_TEMPLATE_NAME,
    status: "sent",
  });
}

function normalizeSizeOptions(options?: SizeOption[] | null): SizeOption[] {
  if (!Array.isArray(options)) return [];
  const seen = new Set<string>();
  const normalized: SizeOption[] = [];
  for (const option of options) {
    const size = typeof option?.size === "string" ? option.size.trim() : "";
    const price = Number(option?.price);
    const key = size.toLowerCase();
    if (!size || !Number.isFinite(price) || price < 0 || seen.has(key)) continue;
    seen.add(key);
    normalized.push({ size, price: Math.round(price) });
  }
  return normalized;
}

function normalizeVariantOptions(options?: VariantOption[] | null): VariantOption[] {
  if (!Array.isArray(options)) return [];
  const seen = new Set<string>();
  const normalized: VariantOption[] = [];
  for (const option of options) {
    const name = typeof option?.name === "string" ? option.name.trim() : "";
    const price = Number(option?.price);
    const key = name.toLowerCase();
    if (!name || !Number.isFinite(price) || price < 0 || seen.has(key)) continue;
    seen.add(key);
    normalized.push({ name, price: Math.round(price) });
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(
  {
    onError: (err) => {
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    },
  },
  async (req: Request) => {
  const origin = req.headers.get("origin");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  // ------------------------------------------------------------------
  // 1. Optionally verify caller JWT (guest checkout is allowed)
  // ------------------------------------------------------------------
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const jwt = authHeader.slice(7);
    const {
      data: { user },
      error: authErr,
    } = await serviceClient.auth.getUser(jwt);

    // If token is invalid/expired, gracefully continue as guest checkout.
    if (!authErr && user) {
      userId = user.id;
    }
  }

  // ------------------------------------------------------------------
  // 2. Parse and validate request body
  // ------------------------------------------------------------------
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  const { items, ship, pay, promo_code, meta } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: "items must be a non-empty array" }, 400, origin);
  }
  for (const item of items) {
    if (typeof item.id !== "string" || !item.id) {
      return json({ error: "Each item must have a string id" }, 400, origin);
    }
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_PRODUCT) {
      return json({ error: `Invalid qty for item ${item.id}` }, 400, origin);
    }
    item.qty = qty; // normalise
  }
  if (!ship?.address || !ship?.city || !ship?.name || !ship?.phone) {
    return json({ error: "Missing required shipping fields" }, 400, origin);
  }

  // Email is optional (checkout no longer asks for it) — validate the format
  // only when a caller actually supplies one, e.g. a logged-in user's account
  // email carried through silently from the client.
  const normalizedEmail = ship.email ? normalizeEmail(ship.email) : "";
  if (normalizedEmail && !isValidEmail(normalizedEmail)) {
    return json({ error: "Invalid email" }, 400, origin);
  }
  ship.email = normalizedEmail;

  if (typeof pay !== "string" || !pay) {
    return json({ error: "Missing payment method" }, 400, origin);
  }

  // ------------------------------------------------------------------
  // 3. Fetch product prices from DB (server-side — cannot be tampered)
  // ------------------------------------------------------------------
  const productIds = [...new Set(items.map((i) => i.id))];
  const [{ data: products, error: productsErr }, { data: costRows }] = await Promise.all([
    serviceClient
      .from("products")
      .select("id, name, cat, price, active, stock, block_when_out_of_stock, size_options, variant_options")
      .in("id", productIds),
    // Cost snapshot for the Net Profit Report — see product_costs (admin-only
    // table, but service-role bypasses RLS). Missing rows default to 0/unknown,
    // same convention the admin-app profit reports already use.
    serviceClient.from("product_costs").select("product_id, purchase_price").in("product_id", productIds),
  ]);

  if (productsErr || !products) {
    return json({ error: "Failed to fetch product data" }, 500, origin);
  }

  const productMap = new Map<string, ProductRow>(products.map((p) => [p.id, p]));
  const costMap = new Map<string, number>(
    (costRows ?? []).map((c) => [c.product_id as string, c.purchase_price as number]),
  );

  // Validate all products exist and are active
  for (const item of items) {
    const product = productMap.get(item.id);
    if (!product) {
      return json({ error: `Product not found: ${item.id}` }, 400, origin);
    }
    if (!product.active) {
      return json({ error: `Product is no longer available: ${item.id}` }, 400, origin);
    }
  }

  // Products flagged block_when_out_of_stock can't be ordered while out of
  // stock (mirror of isOutOfStockBlocked in the storefront's src/wcm/data.ts).
  const outOfStock = items
    .map((item) => productMap.get(item.id)!)
    .filter((product) => product.block_when_out_of_stock && product.stock === "Out of stock");
  if (outOfStock.length > 0) {
    const names = [...new Set(outOfStock.map((product) => product.name))].join(", ");
    return json({ error: `${names} is currently out of stock. Please remove it from your cart.` }, 400, origin);
  }

  // Karachi-only products can't be ordered for any other city.
  if (!/karachi/i.test((ship.city ?? "").trim())) {
    const karachiOnly = items
      .map((item) => productMap.get(item.id)!)
      .filter((product) => KARACHI_ONLY_CATEGORIES.has(product.cat));
    if (karachiOnly.length > 0) {
      const names = [...new Set(karachiOnly.map((product) => product.name))].join(", ");
      return json(
        {
          error: `${names} can only be delivered in Karachi. Please remove it from your cart or change the delivery city to Karachi.`,
        },
        400,
        origin,
      );
    }
  }

  // ------------------------------------------------------------------
  // 4. Re-compute totals server-side
  // ------------------------------------------------------------------
  const pricedItems = items.map((item) => {
    const product = productMap.get(item.id)!;
    const variantOptions = normalizeVariantOptions(product.variant_options);
    const sizeOptions = normalizeSizeOptions(product.size_options);
    const selectableOptions =
      variantOptions.length > 0
        ? variantOptions.map((option) => ({ label: option.name, price: option.price }))
        : sizeOptions.map((option) => ({ label: option.size, price: option.price }));
    let unitPrice = product.price;

    if (selectableOptions.length > 0) {
      if (!item.size || !item.size.trim()) {
        return { error: `Please select an option for ${item.id}` } as const;
      }
      const selected = sizeOptions.find(
        (option) => option.size.toLowerCase() === item.size!.trim().toLowerCase(),
      );
      const selectedVariant = variantOptions.find(
        (option) => option.name.toLowerCase() === item.size!.trim().toLowerCase(),
      );
      const resolvedSelection = selectedVariant || selected;
      if (!resolvedSelection) {
        return { error: `Invalid size selected for ${item.id}` } as const;
      }
      unitPrice = resolvedSelection.price;
      item.size = "name" in resolvedSelection ? resolvedSelection.name : resolvedSelection.size;
    }

    return {
      id: item.id,
      qty: item.qty,
      ...(item.size ? { size: item.size } : {}),
      unit_price: unitPrice,
      line_total: unitPrice * item.qty,
    };
  });

  const pricingError = pricedItems.find((item) => "error" in item);
  if (pricingError && "error" in pricingError) {
    return json({ error: pricingError.error }, 400, origin);
  }

  const finalizedItems = pricedItems as Array<{
    id: string;
    qty: number;
    size?: string;
    unit_price: number;
    line_total: number;
  }>;

  const subtotal = finalizedItems.reduce((sum, item) => sum + item.line_total, 0);

  // Free delivery: Rs 2,000 in Karachi, Rs 5,000 elsewhere, and free on any
  // applied bundle everywhere (below). Keep in sync with computeShipping() in
  // the storefront (src/wcm/data.ts).
  const isKarachiAddress = /karachi/i.test((ship.city ?? "").trim());
  const freeShippingThreshold = isKarachiAddress ? FREE_SHIPPING_THRESHOLD : FREE_SHIPPING_THRESHOLD_OTHER_CITIES;
  // Any applied bundle deal ships free everywhere (mirrors computeShipping's
  // hasBundle flag in the storefront).
  const bundleDiscount = computeBundleDiscount(finalizedItems);
  const shipping =
    subtotal === 0 || bundleDiscount > 0 ? 0 : subtotal >= freeShippingThreshold ? 0 : SHIPPING_COST;

  // Validate + atomically redeem the promo code if provided (it's optional —
  // no code = no discount). redeem_coupon re-validates server-side and
  // increments coupons.times_used in one guarded UPDATE, so it's the actual
  // point of truth for whether a code is still usable — never trust the
  // client's earlier preview_coupon result for this.
  const promoKey = promo_code?.trim().toUpperCase() ?? "";
  let discountAmt = 0;
  if (promoKey) {
    const { data: redeemData, error: redeemErr } = await serviceClient.rpc("redeem_coupon", {
      p_code: promoKey,
      p_subtotal: subtotal,
    });
    const redeemed = redeemData?.[0];
    if (redeemErr || !redeemed) {
      return json({ error: redeemErr?.message ?? "Promo code could not be applied" }, 400, origin);
    }
    discountAmt = redeemed.discount_amount;
  }
  const total = Math.max(0, subtotal + shipping - discountAmt - bundleDiscount);

  // ------------------------------------------------------------------
  // 5. Insert the order using service-role client
  // ------------------------------------------------------------------
  const orderId = generateOrderId();
  const today = new Date();
  // Policy: ETA is always placement date + 5 days, for every order — was
  // +1 day, changed 2026-07-21. Same rule applied in admin-app's manual
  // "Add order" flow (app/orders/page.tsx's createManualOrder) so eta means
  // the same thing regardless of how an order was created.
  const eta = new Date(today);
  eta.setDate(today.getDate() + 5);

  const orderItems = finalizedItems.map((item) => ({
    id: item.id,
    qty: item.qty,
    ...(item.size ? { size: item.size } : {}),
    unit_price: item.unit_price,
    cost_price: costMap.get(item.id) ?? 0,
  }));

  const { data: insertedOrder, error: insertErr } = await serviceClient
    .from("orders")
    .insert({
      user_id: userId,
      customer_name: ship.name.trim(),
      landmark: ship.landmark?.trim() || null,
      email: ship.email,
      order_code: orderId,
      placed: fmtDate(today),
      eta: fmtDate(eta),
      status: "Order placed",
      progress: 0,
      address: `${ship.address}, ${ship.city}`,
      city: ship.city?.trim() || null,
      phone: ship.phone,
      payment: pay,
      items: orderItems,
      subtotal,
      shipping,
      total,
      // Bundle deal savings (see BUNDLES) — same column admin uses for
      // manual order discounts, so it already shows as a Discount line there.
      discount: bundleDiscount,
      promo_code: promoKey || null,
      promo_discount: discountAmt,
      // admin-app's manual "Add/Edit order" flow requires this field and
      // only offers "WhatsApp"/"Friends & Family" — every storefront order
      // needs its own recognized value so admin can still edit it later
      // (an empty source blocked Save entirely, see orders_source migration).
      source: "Storefront",
    })
    .select("id")
    .single();

  if (insertErr) {
    // redeem_coupon (above) already reserved the slot by incrementing
    // times_used — a coupon must only count as redeemed once an order
    // actually exists, so release that reservation before reporting the
    // failure. Best-effort: if this also fails there's nothing more useful
    // to do than let the original insert error surface.
    if (promoKey) {
      await serviceClient.rpc("release_coupon", { p_code: promoKey });
    }
    return json({ error: "Failed to create order" }, 500, origin);
  }

  // ------------------------------------------------------------------
  // 5b. Notify admin of the new order by email (best-effort)
  // ------------------------------------------------------------------
  await sendOrderNotificationEmail({
    orderId,
    ship,
    pay,
    items: orderItems,
    subtotal,
    shipping,
    total,
  });

  // ------------------------------------------------------------------
  // 5c. Send the customer a WhatsApp order confirmation (best-effort)
  // ------------------------------------------------------------------
  await sendWhatsAppOrderConfirmation({
    phone: ship.phone,
    customerName: ship.name.trim(),
    orderId,
    orderRowId: insertedOrder?.id ?? null,
    address: ship.address,
    city: ship.city,
    items: orderItems,
    itemsSummary: buildItemsSummary(orderItems, productMap),
    total,
    pay,
  });

  // ------------------------------------------------------------------
  // 5d. Reward: order over Rs 5,000 earns a one-time Rs 200-off coupon for
  // the customer's NEXT order (best-effort — see issueRewardCoupon).
  // ------------------------------------------------------------------
  let rewardCoupon: { code: string; discount: number } | null = null;
  if (subtotal >= REWARD_COUPON_THRESHOLD) {
    rewardCoupon = await issueRewardCoupon(serviceClient, orderId);
    if (rewardCoupon) {
      await sendWhatsAppRewardCoupon({
        phone: ship.phone,
        customerName: ship.name.trim(),
        orderId,
        orderRowId: insertedOrder?.id ?? null,
        total,
        coupon: rewardCoupon,
      });
    }
  }

  // ------------------------------------------------------------------
  // 6. Increment sales counts
  // ------------------------------------------------------------------
  await Promise.all(
    orderItems.map((item) =>
      serviceClient.rpc("increment_product_sales", { p_id: item.id, p_qty: item.qty }),
    ),
  );

  // ------------------------------------------------------------------
  // 7. Send server-side Purchase event via Meta Conversions API
  // ------------------------------------------------------------------
  const clientIp = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "";
  const userAgent = req.headers.get("user-agent") || "";
  const geo = await resolveGeo(clientIp);
  const eventSourceUrl = req.headers.get("origin") || req.url;
  const numItems = orderItems.reduce((sum, item) => sum + Math.max(1, Number(item.qty) || 1), 0);
  const itemIds = [...new Set(orderItems.map((item) => item.id).filter(Boolean))];

  await sendMetaPurchaseEvent({
    orderId,
    total,
    numItems,
    itemIds,
    email: ship.email,
    phone: ship.phone,
    fbc: meta?.fbc,
    fbp: meta?.fbp,
    visitorId: meta?.visitor_id,
    userAgent,
    clientIp,
    geoCity: geo.geo_city,
    geoRegion: geo.geo_region,
    geoCountry: geo.geo_country,
    eventSourceUrl,
  });

  // ------------------------------------------------------------------
  // 8. Return created order to client
  // ------------------------------------------------------------------
  return json(
    {
      order: {
        id: orderId,
        placed: fmtDate(today),
        eta: fmtDate(eta),
        status: "Order placed",
        progress: 0,
        customer_name: ship.name.trim(),
        landmark: ship.landmark?.trim() || null,
        address: `${ship.address}, ${ship.city}`,
        city: ship.city?.trim() || null,
        phone: ship.phone,
        email: ship.email,
        payment: pay,
        items: orderItems,
        subtotal,
        shipping,
        total,
      },
      // Not persisted on the order row — the coupon itself (in the coupons
      // table) is the durable record. This is only here so the storefront
      // can show it once, right after checkout.
      reward_coupon: rewardCoupon ? { code: rewardCoupon.code, discount: rewardCoupon.discount } : null,
    },
    201,
    origin,
  );
});
