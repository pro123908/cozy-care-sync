import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") || "";
const WHATSAPP_IMPORT_WEBHOOK_SECRET = Deno.env.get("WHATSAPP_IMPORT_WEBHOOK_SECRET") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Helpers: Twilio
// ---------------------------------------------------------------------------

// Every reply here is within the sender's open 24-hour session (they just
// messaged us), so free-form Body is always valid — no Content Template needed.
async function sendTwilioReply(to: string, message: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.error("[whatsapp-customer] Twilio not configured - cannot send reply");
    return;
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: TWILIO_WHATSAPP_FROM, To: to, Body: message }),
    });
    if (!res.ok) {
      console.error("[whatsapp-customer] Twilio send failed", { status: res.status, body: await res.text().catch(() => "") });
    }
  } catch (err) {
    console.error("[whatsapp-customer] Twilio send threw", err);
  }
}

// ---------------------------------------------------------------------------
// Helpers: customer message handling (order status + LLM fallback)
// ---------------------------------------------------------------------------

function lastDigits(value: string, n = 10): string {
  return value.replace(/\D/g, "").slice(-n);
}

const MEDICAL_KEYWORDS = [
  "dose",
  "dosage",
  "side effect",
  "pregnant",
  "allergic",
  "interact",
  "symptom",
  "prescription",
];

const ORDER_STATUS_KEYWORDS = [
  "order",
  "status",
  "track",
  "delivery",
  "kahan",
  "kab",
  "parcel",
  "shipment",
];

const STORE_SYSTEM_PROMPT = `You are a WhatsApp assistant for Well Care Mart, an online pharmacy and health store in Pakistan (wellcaremart.pk).

Store facts you can share:
- Delivery: usually 2-5 business days depending on city and product availability. Free delivery in Karachi on orders Rs 2000+; otherwise a Rs 250 delivery fee applies.
- Returns: accepted only if the product is damaged, defective, or incorrect on delivery, reported within 24 hours of receipt, and unused/unopened in original packaging. Masks, gloves, diapers, and other opened hygiene/disposable/personal-use medical products are not returnable.
- Payment: Cash on Delivery, or bank transfer before dispatch (MCB Islamic Bank).
- Contact: 40 Darul Aman, Road 4, Block 3, Delhi Mercantile Society. WhatsApp/phone +92 329 1557509.

Rules:
- Keep replies short — 1 to 4 sentences, WhatsApp style.
- Never give medical advice, dosage guidance, drug interaction information, or recommend a substitute medicine. If asked, tell the customer to consult their doctor or pharmacist, and say a team member will follow up.
- If you don't know something, say a team member will follow up rather than guessing.
- Do not invent order details, prices, or stock information you don't have.`;

async function generateReply(userMessage: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 200,
        system: STORE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const textBlock = (data.content ?? []).find(
      (b: { type: string; text?: string }) => b.type === "text",
    );
    return textBlock?.text?.trim() || null;
  } catch (err) {
    console.error("[whatsapp-customer] Claude call threw", err);
    return null;
  }
}

async function findRecentOrdersByPhone(
  sender: string,
): Promise<Array<{ order_code: string; status: string; eta: string }>> {
  const suffix = lastDigits(sender);
  if (!suffix) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("order_code, status, eta")
    .ilike("phone", `%${suffix}%`)
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) {
    console.error("[whatsapp-customer] order lookup failed", error);
    return [];
  }
  return (data || []) as Array<{ order_code: string; status: string; eta: string }>;
}

// ---------------------------------------------------------------------------
// Helpers: order-confirmation button taps (Confirm / Cancel)
// ---------------------------------------------------------------------------

type PendingOrder = { id: string; order_code: string; customer_name: string | null };

async function findMostRecentPendingOrder(sender: string): Promise<PendingOrder | null> {
  const suffix = lastDigits(sender);
  if (!suffix) return null;
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_code, customer_name")
    .ilike("phone", `%${suffix}%`)
    .eq("status", "Order placed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[whatsapp-customer] pending order lookup failed", error);
    return null;
  }
  return data as PendingOrder | null;
}

async function logOrderEvent(orderId: string, summary: string): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    table_name: "orders",
    record_id: orderId,
    action: "UPDATE",
    summary,
  });
  if (error) console.error("[whatsapp-customer] audit_logs insert failed", error);
}

async function notifyAdminsOfCancelRequest(order: PendingOrder): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-order-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "whatsapp_cancel_request",
        table: "orders",
        record: { id: order.id },
        notification: {
          title: `⚠️ Cancellation request — ${order.order_code}`,
          body: `${order.customer_name || "A customer"} wants to cancel via WhatsApp. Review in Orders.`,
          url: `/orders?orderId=${order.id}`,
        },
      }),
    });
  } catch (err) {
    console.error("[whatsapp-customer] send-order-push call threw", err);
  }
}

async function handleOrderConfirmationButton(sender: string, buttonPayload: string): Promise<void> {
  try {
    const order = await findMostRecentPendingOrder(sender);
    if (!order) {
      await sendTwilioReply(
        sender,
        "Couldn't find a matching order — please share your order code and we'll check.",
      );
      return;
    }

    if (buttonPayload === "confirm") {
      await logOrderEvent(order.id, "Customer confirmed order via WhatsApp");
      await sendTwilioReply(sender, "Thanks for confirming! We're preparing your order.");
      return;
    }

    if (buttonPayload === "cancel") {
      await logOrderEvent(order.id, "Customer requested cancellation via WhatsApp — needs review");
      await notifyAdminsOfCancelRequest(order);
      await sendTwilioReply(
        sender,
        "Got it — we've flagged this for our team to review, and they'll follow up shortly on the cancellation.",
      );
      return;
    }
  } catch (err) {
    console.error("[whatsapp-customer] button handling failed", err);
    await sendTwilioReply(sender, "Thanks for reaching out — our team will get back to you shortly.");
  }
}

async function handleCustomerMessage(chatId: string, sender: string, text: string) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  try {
    if (MEDICAL_KEYWORDS.some((kw) => lower.includes(kw))) {
      await sendTwilioReply(
        chatId,
        "For medical questions please consult your doctor or pharmacist — I'll flag this for our team to follow up.",
      );
      return;
    }

    if (ORDER_STATUS_KEYWORDS.some((kw) => lower.includes(kw))) {
      const orders = await findRecentOrdersByPhone(sender);
      if (orders.length === 0) {
        await sendTwilioReply(
          chatId,
          "No recent orders found for this number — send your order code and we'll check.",
        );
        return;
      }
      const lines = orders.map((o) => `${o.order_code}: ${o.status} (ETA ${o.eta})`);
      await sendTwilioReply(chatId, ["Here's your recent order status:", ...lines].join("\n"));
      return;
    }

    const reply = await generateReply(trimmed);
    await sendTwilioReply(
      chatId,
      reply || "Thanks for reaching out — our team will get back to you shortly.",
    );
  } catch (err) {
    console.error("[whatsapp-customer] handling failed", err);
    await sendTwilioReply(chatId, "Thanks for reaching out — our team will get back to you shortly.");
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

// Twilio's webhook has no custom-header hook, so the shared secret travels
// as a URL query param on the webhook URL configured in the Twilio console
// (e.g. https://.../whatsapp-product-import?secret=...) instead of a header.
function ackTwiml(): Response {
  return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  if (!WHATSAPP_IMPORT_WEBHOOK_SECRET) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const providedSecret = new URL(req.url).searchParams.get("secret") || "";
  if (providedSecret !== WHATSAPP_IMPORT_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const form = await req.formData().catch(() => null);

  // Always respond with TwiML immediately
  const ack = ackTwiml();

  if (!form) return ack;

  const from = String(form.get("From") || "");
  const bodyText = String(form.get("Body") || "");
  const buttonPayload = form.get("ButtonPayload");

  if (!from) return ack; // malformed request

  if (buttonPayload === "confirm" || buttonPayload === "cancel") {
    await handleOrderConfirmationButton(from, buttonPayload);
    return ack;
  }

  await handleCustomerMessage(from, from, bodyText);
  return ack;
});
