// Triggered on a schedule by pg_cron (see
// supabase/migrations/*_auto_feedback_requests_cron.sql) — finds Delivered
// orders that are ready for a feedback-request WhatsApp message and sends
// them automatically via send-feedback-request, removing the manual
// select-rows-and-click-Send step on admin-app's /feedback-requests page.
//
// "Ready" means: delivered at least ONE_DAY_WAIT ago (gives the customer
// time to actually receive/try the product before asking for a review), no
// more than BACKLOG_CAP_DAYS ago (an order delivered a month ago suddenly
// getting a review ask reads as random, not a deliberate backlog run — the
// admin page remains available to send those manually if wanted), and
// doesn't already have a sent feedback_ontime/feedback_late log entry.
//
// Late-vs-ontime threshold (LATE_GRACE_DAYS) must match
// app/feedback-requests/page.tsx's constant in admin-app — both decide the
// same thing (is this order late enough to deserve an apology line) and
// diverging would make the manual page's "suggested" variant lie about what
// the auto-sender actually chose for the same order.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { captureError } from "../_shared/sentry.ts";

const AUTO_FEEDBACK_REQUESTS_SECRET = Deno.env.get("AUTO_FEEDBACK_REQUESTS_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SHIPMENT_NOTIFY_SECRET = Deno.env.get("SHIPMENT_NOTIFY_SECRET") || "";

const ONE_DAY_WAIT_MS = 1 * 24 * 60 * 60 * 1000;
const BACKLOG_CAP_MS = 14 * 24 * 60 * 60 * 1000;
const LATE_GRACE_DAYS = 2;

type Variant = "ontime" | "late";

type OrderRow = {
  id: string;
  order_code: string;
  customer_name: string | null;
  phone: string | null;
  eta: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 86400000;
  const aDay = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bDay = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((bDay - aDay) / MS_PER_DAY);
}

Deno.serve(
  {
    onError: (err) => {
      captureError(err);
      return json({ error: "Internal error" }, 500);
    },
  },
  async (req: Request) => {
    if (!AUTO_FEEDBACK_REQUESTS_SECRET || req.headers.get("x-auto-feedback-requests-secret") !== AUTO_FEEDBACK_REQUESTS_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SHIPMENT_NOTIFY_SECRET) {
      return json({ error: "auto-feedback-requests not fully configured" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const now = Date.now();
    const windowFrom = new Date(now - BACKLOG_CAP_MS).toISOString();
    const windowTo = new Date(now - ONE_DAY_WAIT_MS).toISOString();

    // Reconstruct each order's delivered-at timestamp from its audit trail
    // (orders has no delivered_at column of its own — same source
    // app/feedback-requests/page.tsx uses), bounded to the window we care
    // about so this doesn't scan the entire audit history every run.
    const { data: deliveryAudit, error: auditError } = await supabase
      .from("audit_logs")
      .select("record_id, created_at")
      .eq("table_name", "orders")
      .ilike("new_data->>status", "Delivered")
      .gte("created_at", windowFrom)
      .lte("created_at", windowTo);
    if (auditError) {
      console.error("[auto-feedback-requests] audit_logs query failed", auditError.message);
      return json({ error: "Could not read delivery audit trail" }, 500);
    }

    const deliveredAtByOrderId = new Map<string, string>();
    for (const row of deliveryAudit ?? []) {
      if (!row.record_id) continue;
      const existing = deliveredAtByOrderId.get(row.record_id);
      if (!existing || row.created_at > existing) deliveredAtByOrderId.set(row.record_id, row.created_at);
    }
    const candidateIds = Array.from(deliveredAtByOrderId.keys());
    if (candidateIds.length === 0) {
      return json({ processed: 0, sent: 0, skipped: 0, errors: 0 });
    }

    // Re-confirm current status is still Delivered (not since Returned etc.)
    // and pull what send-feedback-request needs. feedback_request_hold_at
    // lets admin-app staff exclude a specific order (e.g. it's being
    // returned) without touching status — see
    // app/feedback-requests/page.tsx in admin-app.
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, order_code, customer_name, phone, eta")
      .in("id", candidateIds)
      .ilike("status", "Delivered")
      .is("feedback_request_hold_at", null)
      .returns<OrderRow[]>();
    if (ordersError) {
      console.error("[auto-feedback-requests] orders query failed", ordersError.message);
      return json({ error: "Could not read orders" }, 500);
    }

    const { data: alreadySent, error: sentError } = await supabase
      .from("whatsapp_message_log")
      .select("order_id")
      .in("order_id", candidateIds)
      .in("message_type", ["feedback_ontime", "feedback_late"])
      .eq("status", "sent");
    if (sentError) {
      console.error("[auto-feedback-requests] whatsapp_message_log query failed", sentError.message);
      return json({ error: "Could not read whatsapp_message_log" }, 500);
    }
    const alreadySentIds = new Set((alreadySent ?? []).map((r) => r.order_id).filter(Boolean));

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const order of orders ?? []) {
      if (alreadySentIds.has(order.id)) {
        skipped++;
        continue;
      }
      if (!order.phone) {
        skipped++;
        continue;
      }

      const deliveredAtIso = deliveredAtByOrderId.get(order.id)!;
      const eta = order.eta ? new Date(order.eta) : null;
      let variant: Variant = "ontime";
      if (eta && !Number.isNaN(eta.getTime())) {
        const late = daysBetween(eta, new Date(deliveredAtIso)) > LATE_GRACE_DAYS;
        variant = late ? "late" : "ontime";
      }

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-feedback-request`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-shipment-notify-secret": SHIPMENT_NOTIFY_SECRET },
          body: JSON.stringify({
            orderId: order.id,
            orderCode: order.order_code,
            name: order.customer_name || "",
            phone: order.phone,
            variant,
          }),
        });
        if (res.ok) {
          sent++;
        } else {
          errors++;
          console.error("[auto-feedback-requests] send failed", { orderCode: order.order_code, status: res.status });
        }
      } catch (err) {
        errors++;
        console.error("[auto-feedback-requests] send threw", { orderCode: order.order_code, err: String(err) });
      }
    }

    return json({ processed: (orders ?? []).length, sent, skipped, errors });
  },
);
