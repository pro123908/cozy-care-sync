// Triggered by a Postgres AFTER INSERT trigger on public.orders (see
// supabase/migrations/20260710160000_push_notifications.sql) whenever a new
// order is placed. Sends a Web Push notification to every subscribed
// admin/staff device so the order shows up as a phone/desktop notification.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

type OrdersRow = {
  id: string;
  order_code: string;
  customer_name?: string | null;
  total?: number | null;
};

type WebhookPayload = {
  type: string;
  table: string;
  record: OrdersRow;
  // Optional override so non-order-insert callers (e.g. a WhatsApp
  // cancellation-request flag) can send an arbitrary notification without
  // needing an orders row shaped like a new order.
  notification?: { title: string; body: string; url: string };
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@wellcaremart.pk";

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

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[send-order-push] missing Supabase env vars");
    return json({ error: "Missing configuration" }, 500);
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.info("[send-order-push] missing VAPID keys - skipping");
    return json({ skipped: true });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const order = payload.record;
  if (!order && !payload.notification) {
    return json({ skipped: true });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: subscriptions, error } = await client
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  if (error) {
    console.error("[send-order-push] failed to load subscriptions", error);
    return json({ error: "Failed to load subscriptions" }, 500);
  }
  if (!subscriptions || subscriptions.length === 0) {
    console.info("[send-order-push] no subscriptions - skipping");
    return json({ skipped: true });
  }

  const notificationPayload = JSON.stringify(
    payload.notification ?? {
      title: `New order ${order.order_code}`,
      body: `${order.customer_name || "A customer"} · Rs ${(order.total ?? 0).toLocaleString()}`,
      url: `/orders?orderId=${order.id}`,
    },
  );

  const staleIds: string[] = [];

  await Promise.all(
    (subscriptions as PushSubscriptionRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationPayload,
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          console.error("[send-order-push] send failed", { id: sub.id, statusCode, err });
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    const { error: deleteError } = await client
      .from("push_subscriptions")
      .delete()
      .in("id", staleIds);
    if (deleteError) {
      console.error("[send-order-push] failed to clean up stale subscriptions", deleteError);
    }
  }

  return json({ ok: true, sent: subscriptions.length - staleIds.length, removed: staleIds.length });
});
