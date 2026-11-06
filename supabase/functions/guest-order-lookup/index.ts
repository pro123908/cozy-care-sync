import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type LookupBody = {
  order_id?: string;
  phone?: string;
};

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

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

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

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  let body: LookupBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  const orderId = (body.order_id || "").trim().toUpperCase();
  const phone = (body.phone || "").trim();

  if (!orderId || !phone) {
    return json({ error: "order_id and phone are required" }, 400, origin);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: row, error } = await supabase
    .from("orders")
    .select(
      "order_code, placed, eta, status, progress, address, city, landmark, customer_name, payment, items, subtotal, shipping, total, discount, promo_discount, promo_code, rider, phone, user_id, replaces_order_id, replacement_balance_due",
    )
    .eq("order_code", orderId)
    .maybeSingle();

  if (error) {
    return json({ error: "Could not fetch order" }, 500, origin);
  }

  if (!row || row.user_id) {
    return json({ error: "Order not found" }, 404, origin);
  }

  if (!row.phone || normalizePhone(row.phone) !== normalizePhone(phone)) {
    return json({ error: "Order not found" }, 404, origin);
  }

  const { data: reviews, error: reviewsError } = await supabase
    .from("order_reviews")
    .select("product_id, rating, comment")
    .eq("order_code", orderId)
    .is("user_id", null);

  if (reviewsError) {
    return json({ error: "Could not fetch order reviews" }, 500, origin);
  }

  // An order can have more than one courier_bookings row — either a
  // legitimate re-book after a cancelled attempt, or a duplicate booking
  // from PostEx's batch-book race (see
  // project_postex_duplicate_bookings_batch_book_race memory in the admin
  // app: the same order got booked twice ~seconds apart, and the duplicate
  // gets cancelled once caught). Either way, `synced_at` can't tell them
  // apart: the periodic sync cron stamps every row it touches in a run with
  // one shared "now", so both rows here carry an identical synced_at
  // regardless of which was actually created first or is still active.
  // Rank by status instead — an active/delivered booking is what the
  // customer actually cares about, so it wins over a cancelled one even if
  // the cancelled row happens to be the more recently created of the two
  // (as in the duplicate-booking case above). "Return" gets its own rank
  // below active but above cancelled: a booking working its way back to
  // origin is a real, current shipment state the customer should see, not
  // an abandoned duplicate — lumping it in with "cancel" let a genuinely
  // dead cancelled booking outrank it on tie-break (hit for real 2026-09-01,
  // order WCM-20260804-VPW2: a cancelled PostEx booking was shown instead
  // of the actual Leopards shipment the customer had refused and was
  // returning). Only falls back to picking the single row present when
  // every booking for this order is cancelled.
  const { data: courierRows } = await supabase
    .from("courier_bookings")
    .select("tracking_number, status, status_history, courier, created_at")
    .eq("order_id", orderId);
  const statusRank = (status: string | null): number => {
    const s = (status ?? "").toLowerCase();
    if (s.includes("deliver")) return 0;
    if (s.includes("cancel")) return 3;
    if (s.includes("return")) return 2;
    return 1;
  };
  // created_at (real per-row insert time, added for exactly this) breaks
  // ties within the same rank — synced_at couldn't, per the comment above.
  const courierRow = courierRows && courierRows.length > 0
    ? [...courierRows].sort((a, b) => statusRank(a.status) - statusRank(b.status) || (b.created_at > a.created_at ? 1 : -1))[0]
    : null;

  const productReviews = (reviews || []).reduce(
    (acc: Record<string, { rating: number; comment: string }>, review) => {
      if (!review.product_id || review.product_id === "__order__") return acc;
      acc[review.product_id] = {
        rating: Number(review.rating) || 0,
        comment: review.comment || "",
      };
      return acc;
    },
    {},
  );

  return json(
    {
      order: {
        id: row.order_code,
        placed: row.placed,
        eta: row.eta,
        status: row.status,
        progress: row.progress,
        address: row.address,
        city: row.city,
        landmark: row.landmark,
        customerName: row.customer_name,
        payment: row.payment,
        items: row.items,
        subtotal: row.subtotal,
        shipping: row.shipping,
        total: row.total,
        discount: row.discount ?? 0,
        promoDiscount: row.promo_discount ?? 0,
        promoCode: row.promo_code ?? null,
        replacesOrderId: row.replaces_order_id,
        replacementBalanceDue: row.replacement_balance_due,
        rider: row.rider,
        product_reviews: productReviews,
        courier: courierRow
          ? {
              trackingNumber: courierRow.tracking_number,
              status: courierRow.status,
              statusHistory: courierRow.status_history ?? null,
              provider: courierRow.courier,
            }
          : null,
      },
    },
    200,
    origin,
  );
});
