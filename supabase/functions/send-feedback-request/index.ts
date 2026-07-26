// Called server-to-server by admin-app whenever staff pick one or more
// Delivered orders on the "Feedback Requests" page and hit Send — sends a
// "thank you, please review us on Facebook" WhatsApp message. Two template
// variants: `delivery_feedback_ontime` / `delivery_feedback_late` (the admin
// picks which one per order, typically pre-suggested by comparing the
// order's delivered date against its eta). Both templates are Marketing
// category (Meta auto-classified them, since a review ask isn't a
// transactional utility update) — business-initiated, so must use an
// approved template regardless of any open customer-service window.
//
// Fires a *paid* send per call, so it's protected the same way as
// send-shipment-notification: a shared-secret header, not this repo's usual
// no-auth convention. Reuses that same SHIPMENT_NOTIFY_SECRET rather than
// minting a new one — the trust boundary (admin-app calling a paid-send
// function) is identical, and it's already configured on both sides.

import { logWhatsAppMessage } from "../_shared/whatsappLog.ts";

const SHIPMENT_NOTIFY_SECRET = Deno.env.get("SHIPMENT_NOTIFY_SECRET") || "";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
const WHATSAPP_FEEDBACK_TEMPLATE_ONTIME = Deno.env.get("WHATSAPP_FEEDBACK_TEMPLATE_ONTIME") || "delivery_feedback_ontime";
const WHATSAPP_FEEDBACK_TEMPLATE_LATE = Deno.env.get("WHATSAPP_FEEDBACK_TEMPLATE_LATE") || "delivery_feedback_late";
const WHATSAPP_TEMPLATE_LANG = Deno.env.get("WHATSAPP_TEMPLATE_LANG") || "en";
const WHATSAPP_GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v21.0";

type Variant = "ontime" | "late";

type RequestBody = {
  orderId: string;
  orderCode: string;
  name: string;
  phone: string;
  variant: Variant;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Cloud API wants the recipient as a bare international number (digits only,
// country code included, no "+") — same helper as place-order/send-shipment-notification.
function toWhatsAppNumber(rawPhone: string): string | null {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return null;
  let national = digits;
  if (national.startsWith("0")) national = national.slice(1);
  if (!national.startsWith("92")) national = `92${national}`;
  return national;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!SHIPMENT_NOTIFY_SECRET || req.headers.get("x-shipment-notify-secret") !== SHIPMENT_NOTIFY_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { orderId, orderCode, name, phone, variant } = body;
  if (!orderId || !orderCode || !phone || (variant !== "ontime" && variant !== "late")) {
    return json({ error: "orderId, orderCode, phone, and a valid variant ('ontime'|'late') are required" }, 400);
  }

  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    return json({ error: "WhatsApp Cloud API not configured" }, 500);
  }

  const to = toWhatsAppNumber(phone);
  if (!to) {
    return json({ error: "Invalid phone" }, 400);
  }

  const templateName = variant === "late" ? WHATSAPP_FEEDBACK_TEMPLATE_LATE : WHATSAPP_FEEDBACK_TEMPLATE_ONTIME;
  const textParam = (text: string) => ({ type: "text", text });

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: WHATSAPP_TEMPLATE_LANG },
      components: [
        {
          type: "body",
          parameters: [textParam(name?.trim() || "there"), textParam(orderCode)],
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
      const text = await res.text().catch(() => "");
      console.error("[feedback-request] send failed", { status: res.status, body: text });
      await logWhatsAppMessage({
        orderId,
        orderCode,
        phone,
        messageType: variant === "late" ? "feedback_late" : "feedback_ontime",
        templateName,
        status: "failed",
        errorDetail: text,
      });
      return json({ error: "WhatsApp send failed", detail: text }, 502);
    }
  } catch (err) {
    console.error("[feedback-request] send threw", err);
    await logWhatsAppMessage({
      orderId,
      orderCode,
      phone,
      messageType: variant === "late" ? "feedback_late" : "feedback_ontime",
      templateName,
      status: "failed",
      errorDetail: String(err),
    });
    return json({ error: "WhatsApp send threw" }, 500);
  }

  await logWhatsAppMessage({
    orderId,
    orderCode,
    phone,
    messageType: variant === "late" ? "feedback_late" : "feedback_ontime",
    templateName,
    status: "sent",
  });

  return json({ sent: true });
});
