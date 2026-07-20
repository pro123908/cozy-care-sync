// Called server-to-server by admin-app's courier sync route
// (app/api/courier/bookings/route.ts) whenever a booking's status
// transitions to "Dispatched" — sends the customer a "picked up by
// courier" WhatsApp notification via Meta's Cloud API. Business-initiated
// (outside any open customer-service window), so this must use a
// pre-approved template (`order_shipment`, submitted 2026-07-20).
//
// Unlike every other function in this project, this one fires a *paid*
// WhatsApp send per call — protected by a shared-secret header instead of
// this repo's usual "no auth, verify_jwt=false" convention, so a
// leaked/guessed URL can't be used to run up messaging costs.

const SHIPMENT_NOTIFY_SECRET = Deno.env.get("SHIPMENT_NOTIFY_SECRET") || "";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
// Left unset until Meta approves `order_shipment` — sends are skipped until
// then, same "don't deploy send code before the template is approved"
// lesson from the order_confirmation_final param-count mismatch.
const WHATSAPP_SHIPMENT_TEMPLATE_NAME = Deno.env.get("WHATSAPP_SHIPMENT_TEMPLATE_NAME") || "";
const WHATSAPP_TEMPLATE_LANG = Deno.env.get("WHATSAPP_TEMPLATE_LANG") || "en";
const WHATSAPP_GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v21.0";

type RequestBody = {
  name: string;
  orderCode: string;
  trackingNumber: string;
  phone: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Cloud API wants the recipient as a bare international number (digits only,
// country code included, no "+") — e.g. 923390104375. Same helper as
// place-order's toWhatsAppNumber.
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

  const { name, orderCode, trackingNumber, phone } = body;
  if (!orderCode || !trackingNumber || !phone) {
    return json({ error: "orderCode, trackingNumber, and phone are required" }, 400);
  }

  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.info("[shipment-notification] Cloud API not fully configured - skipping");
    return json({ skipped: true, reason: "Cloud API not configured" });
  }
  if (!WHATSAPP_SHIPMENT_TEMPLATE_NAME) {
    console.info("[shipment-notification] WHATSAPP_SHIPMENT_TEMPLATE_NAME not set - skipping (template not approved yet?)");
    return json({ skipped: true, reason: "Shipment template not configured" });
  }

  const to = toWhatsAppNumber(phone);
  if (!to) {
    return json({ error: "Invalid phone" }, 400);
  }

  const textParam = (text: string) => ({ type: "text", text });
  // Packed token for the "Track Your Order" button — same "<order_code>_<phone>"
  // format /track-order already parses (built 2026-07-19), raw phone (not
  // digit-stripped) to match how admin-app builds the same link elsewhere.
  const trackingToken = `${orderCode}_${phone}`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: WHATSAPP_SHIPMENT_TEMPLATE_NAME,
      language: { code: WHATSAPP_TEMPLATE_LANG },
      components: [
        {
          type: "body",
          parameters: [
            textParam(name?.trim() || "there"),
            textParam(orderCode),
            textParam(trackingNumber),
          ],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [textParam(trackingToken)],
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
      console.error("[shipment-notification] send failed", { status: res.status, body: text });
      return json({ error: "WhatsApp send failed", detail: text }, 502);
    }
  } catch (err) {
    console.error("[shipment-notification] send threw", err);
    return json({ error: "WhatsApp send threw" }, 500);
  }

  return json({ sent: true });
});
