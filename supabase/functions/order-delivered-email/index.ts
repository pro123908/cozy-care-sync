// Triggered by a Postgres AFTER UPDATE trigger on public.orders (see
// supabase/migrations/20260710120000_order_delivered_email_trigger.sql) whenever an
// order's status transitions into "Delivered". Sends the customer a transactional
// email with their order summary and a link to leave feedback.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type OrderItem = { id: string; qty: number; size?: string; unit_price: number };

type OrdersRow = {
  order_code: string;
  email?: string | null;
  phone?: string | null;
  customer_name?: string | null;
  status: string;
  items?: OrderItem[] | null;
  total?: number | null;
};

type WebhookPayload = {
  type: string;
  table: string;
  record: OrdersRow;
  old_record?: OrdersRow | null;
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ORDER_NOTIFY_FROM = Deno.env.get("ORDER_NOTIFY_FROM") || "Well Care Mart <onboarding@resend.dev>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

// Order items store the product code (e.g. "oth-002") in `id`. Resolve those to the
// human-readable product name from the products table so the email is legible.
// Falls back to the code for any product that can't be found.
async function fetchProductNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (uniqueIds.length === 0 || !SUPABASE_URL || !SERVICE_ROLE_KEY) return names;

  try {
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client
      .from("products")
      .select("id, name")
      .in("id", uniqueIds);
    if (error) {
      console.error("[order-delivered-email] failed to fetch product names", error);
      return names;
    }
    for (const product of data ?? []) {
      if (product?.id && product?.name) names.set(product.id, product.name);
    }
  } catch (err) {
    console.error("[order-delivered-email] fetch product names threw", err);
  }
  return names;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendDeliveredEmail(order: OrdersRow) {
  const email = order.email?.trim();
  if (!email) {
    console.info("[order-delivered-email] order has no email - skipping", order.order_code);
    return;
  }
  if (!RESEND_API_KEY) {
    console.info("[order-delivered-email] missing RESEND_API_KEY - skipping");
    return;
  }

  const items = order.items ?? [];
  const total = order.total ?? 0;
  const feedbackUrl = "https://www.facebook.com/profile.php?id=61564545159068&sk=reviews";

  const productNames = await fetchProductNames(items.map((item) => item.id));
  const nameFor = (item: OrderItem) => productNames.get(item.id) || item.id;

  const text = [
    `Hi ${order.customer_name || "there"},`,
    "",
    `Your order ${order.order_code} has been delivered!`,
    "",
    "Items:",
    ...items.map(
      (item) => `- ${nameFor(item)}${item.size ? ` (${item.size})` : ""} x${item.qty}  Rs ${(item.unit_price * item.qty).toLocaleString()}`,
    ),
    "",
    `Total: Rs ${total.toLocaleString()}`,
    "",
    "We'd love to hear what you think — leave a quick review on our Facebook page:",
    feedbackUrl,
  ].join("\n");

  const rows = items
    .map(
      (item, i) =>
        `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#fafaf7"}">` +
        `<td style="padding:10px 12px;border-bottom:1px solid #eeece5;color:#1e293b;font-size:14px">${escapeHtml(nameFor(item))}${item.size ? ` <span style="color:#64748b">(${escapeHtml(item.size)})</span>` : ""}</td>` +
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
                <span style="color:#cbd5e1;font-size:13px">Order delivered</span>
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
                <div style="font-size:20px;font-weight:700;color:#0f172a">Your order has arrived! 📦</div>
                <div style="font-size:13px;color:#64748b;margin-top:2px">Order ${escapeHtml(order.order_code)}</div>
              </td>
              <td style="text-align:right;vertical-align:top">
                <span style="display:inline-block;background:#dcfce7;color:#15803d;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px">Delivered</span>
              </td>
            </tr>
          </table>
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
                  <tr><td style="padding:8px 0 0;font-size:16px;font-weight:700;color:#0f172a">Total</td><td style="text-align:right;padding:8px 0 0;font-size:16px;font-weight:700;color:#0f172a">Rs ${total.toLocaleString()}</td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 8px">
          <div style="font-size:14px;color:#475569;text-align:center">How was your experience? Your feedback helps us improve.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 28px">
          <a href="${feedbackUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#2563eb,#10b981);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px;border-radius:10px">Leave a review on Facebook</a>
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
        to: [email],
        subject: `Your order ${order.order_code} has been delivered! 📦`,
        text,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[order-delivered-email] send failed", { status: res.status, body: await res.text().catch(() => "") });
    }
  } catch (err) {
    console.error("[order-delivered-email] send threw", err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const order = payload.record;
  const wasAlreadyDelivered = payload.old_record?.status === "Delivered";

  if (!order || order.status !== "Delivered" || wasAlreadyDelivered) {
    return json({ skipped: true });
  }

  await sendDeliveredEmail(order);

  return json({ ok: true });
});
