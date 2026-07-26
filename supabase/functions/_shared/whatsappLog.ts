import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Shared by every function that sends an automated WhatsApp message
// (place-order's order confirmation, send-shipment-notification,
// send-feedback-request, whatsapp-inbound's Confirm/Cancel acks) — feeds the
// admin panel's unified WhatsApp message log (app/feedback-requests and
// app/whatsapp-messages in the admin-app repo). Best-effort: a logging
// failure must never mask whether the actual WhatsApp send itself succeeded.

export type WhatsAppMessageType =
  | "order_confirmation"
  | "shipment_notification"
  | "feedback_ontime"
  | "feedback_late"
  | "confirm_ack"
  | "cancel_ack";

const logClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export async function logWhatsAppMessage(row: {
  orderId?: string | null;
  orderCode: string;
  phone: string;
  messageType: WhatsAppMessageType;
  templateName?: string | null;
  status: "sent" | "failed";
  errorDetail?: string | null;
}): Promise<void> {
  const { error } = await logClient.from("whatsapp_message_log").insert({
    order_id: row.orderId ?? null,
    order_code: row.orderCode,
    phone: row.phone,
    message_type: row.messageType,
    template_name: row.templateName ?? null,
    status: row.status,
    error_detail: row.errorDetail ?? null,
  });
  if (error) console.error("[whatsapp-message-log] insert failed", error.message);
}
