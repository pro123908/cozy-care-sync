// Public endpoint behind the product page's "Ask a question" form. Validates,
// rate-limits per IP, stores the question (status 'pending') and pings staff on
// WhatsApp. Staff answer it in the admin Questions page; answered questions are
// then published on the product page via the public_product_questions() RPC.
//
// The WhatsApp alert is optional and INERT until both
// WHATSAPP_QUESTION_ALERT_TEMPLATE_NAME and WHATSAPP_QUESTION_ALERT_NUMBERS are
// set (internal staff content must be an approved template; Meta classes it as
// Marketing, ~Rs 13 per recipient per question). The question is stored either
// way; a skipped/failed alert never fails the submission, and a failed send is
// logged to whatsapp_message_log so it stays visible.
//
// Template body (4 variables, none at the very start/end, no newlines):
//   New question on {{1}}: "{{2}}" Asked by {{3}}. Open the admin Questions page to answer.
// {{1}} product name, {{2}} question (trimmed), {{3}} asker name or "a customer".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { logWhatsAppMessage } from "../_shared/whatsappLog.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
const WHATSAPP_GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v21.0";
const WHATSAPP_TEMPLATE_LANG = Deno.env.get("WHATSAPP_TEMPLATE_LANG") || "en";
const TEMPLATE_NAME = Deno.env.get("WHATSAPP_QUESTION_ALERT_TEMPLATE_NAME") || "";

const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("0") ? `92${digits.slice(1)}` : digits;
};
const RECIPIENTS = (Deno.env.get("WHATSAPP_QUESTION_ALERT_NUMBERS") || "")
  .split(",")
  .map(normalizePhone)
  .filter(Boolean);

// Per-IP cap on stored questions, and a global cap on alert messages (= cost).
const MAX_PER_IP_PER_HOUR = 3;
const MAX_ALERTS_PER_HOUR = 20;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

// Variables can't contain newlines/tabs or 4+ consecutive spaces (Cloud API 132018).
const oneLine = (text: string, max: number) => text.replace(/\s+/g, " ").trim().slice(0, max);

async function alertStaff(productName: string, question: string, askerName: string | null, productId: string) {
  if (!TEMPLATE_NAME || RECIPIENTS.length === 0 || !WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) return;

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("whatsapp_message_log")
    .select("id", { count: "exact", head: true })
    .eq("message_type", "question_alert")
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_ALERTS_PER_HOUR) return;

  const params = [productName, question, askerName || "a customer"].map((t, i) => ({
    type: "text",
    text: oneLine(t, i === 1 ? 200 : 80) || "-",
  }));

  for (const to of RECIPIENTS) {
    let ok = false;
    let detail: string | null = null;
    try {
      const res = await fetch(
        `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: TEMPLATE_NAME,
              language: { code: WHATSAPP_TEMPLATE_LANG },
              components: [{ type: "body", parameters: params }],
            },
          }),
        },
      );
      ok = res.ok;
      if (!ok) detail = (await res.text().catch(() => "")) || `HTTP ${res.status}`;
    } catch (err) {
      detail = err instanceof Error ? err.message : String(err);
    }
    await logWhatsAppMessage({
      orderCode: productId,
      phone: to,
      messageType: "question_alert",
      templateName: TEMPLATE_NAME,
      status: ok ? "sent" : "failed",
      errorDetail: detail,
    });
  }
}

Deno.serve(
  {
    onError: () =>
      new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
  },
  async (req: Request) => {
    const origin = req.headers.get("origin");
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

    const body = (await req.json().catch(() => null)) as {
      product_id?: unknown;
      question?: unknown;
      name?: unknown;
      phone?: unknown;
      website?: unknown;
    } | null;
    if (!body) return json({ error: "Invalid request" }, 400, origin);

    // Honeypot: real visitors never see/fill this field. Pretend success to bots.
    if (typeof body.website === "string" && body.website.trim()) return json({ ok: true }, 200, origin);

    const productId = typeof body.product_id === "string" ? body.product_id.trim() : "";
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const name = typeof body.name === "string" ? oneLine(body.name, 60) : "";
    const phoneDigits = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";

    if (!productId) return json({ error: "Missing product" }, 400, origin);
    if (question.length < 5) return json({ error: "Please write your question (at least 5 characters)." }, 400, origin);
    if (question.length > 500) return json({ error: "Question is too long (500 characters max)." }, 400, origin);
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
      return json({ error: "Please enter a valid phone number or leave it empty." }, 400, origin);
    }

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || null;

    if (ip) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("product_questions")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ip)
        .gte("created_at", since);
      if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) {
        return json({ error: "You've asked a few questions already. Please try again later." }, 429, origin);
      }
    }

    const { data: product } = await supabase
      .from("products")
      .select("id, name")
      .eq("id", productId)
      .eq("active", true)
      .maybeSingle();
    if (!product) return json({ error: "Product not found" }, 404, origin);

    const { error } = await supabase.from("product_questions").insert({
      product_id: product.id,
      question,
      asker_name: name || null,
      asker_phone: phoneDigits || null,
      ip_address: ip,
    });
    if (error) {
      console.error("[submit-product-question] insert failed", error.message);
      return json({ error: "Could not save your question. Please try again." }, 500, origin);
    }

    // Best-effort; never fails the submission.
    try {
      await alertStaff(product.name, question, name || null, product.id);
    } catch (err) {
      console.error("[submit-product-question] alert failed", err);
    }

    return json({ ok: true }, 200, origin);
  },
);
