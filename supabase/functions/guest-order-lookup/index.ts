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

Deno.serve(async (req: Request) => {
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
      "order_code, placed, eta, status, progress, address, customer_name, payment, items, subtotal, shipping, total, rider, phone, user_id",
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

  // An order can have more than one courier_bookings row (e.g. re-booked
  // after a cancelled attempt) — take the most recently synced one.
  const { data: courierRows } = await supabase
    .from("courier_bookings")
    .select("tracking_number, status, status_history")
    .eq("order_id", orderId)
    .order("synced_at", { ascending: false })
    .limit(1);
  const courierRow = courierRows?.[0] ?? null;

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
        customerName: row.customer_name,
        payment: row.payment,
        items: row.items,
        subtotal: row.subtotal,
        shipping: row.shipping,
        total: row.total,
        rider: row.rider,
        product_reviews: productReviews,
        courier: courierRow
          ? {
              trackingNumber: courierRow.tracking_number,
              status: courierRow.status,
              statusHistory: courierRow.status_history ?? null,
            }
          : null,
      },
    },
    200,
    origin,
  );
});
