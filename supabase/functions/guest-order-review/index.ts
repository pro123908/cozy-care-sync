import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type ReviewBody = {
  order_id?: string;
  phone?: string;
  product_id?: string;
  rating?: number;
  comment?: string;
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

  let body: ReviewBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  const orderId = (body.order_id || "").trim().toUpperCase();
  const phone = (body.phone || "").trim();
  const productId = (body.product_id || "").trim();
  const rating = Number(body.rating);
  const comment = (body.comment || "").trim().slice(0, 1000);

  if (!orderId || !phone || !productId || !Number.isInteger(rating)) {
    return json(
      { error: "order_id, phone, product_id and integer rating are required" },
      400,
      origin,
    );
  }

  if (rating < 1 || rating > 5) {
    return json({ error: "rating must be between 1 and 5" }, 400, origin);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("order_code, phone, user_id, status, items")
    .eq("order_code", orderId)
    .maybeSingle();

  if (orderErr) return json({ error: "Could not fetch order" }, 500, origin);
  if (!order || order.user_id) return json({ error: "Order not found" }, 404, origin);

  if (!order.phone || normalizePhone(order.phone) !== normalizePhone(phone)) {
    return json({ error: "Order not found" }, 404, origin);
  }

  if (order.status !== "Delivered") {
    return json({ error: "Reviews are allowed only for delivered orders" }, 400, origin);
  }

  const orderItems = Array.isArray(order.items) ? order.items : [];
  const productInOrder = orderItems.some((item) => {
    if (!item || typeof item !== "object") return false;
    return String((item as Record<string, unknown>).id || "") === productId;
  });

  if (!productInOrder) {
    return json({ error: "Product does not belong to this order" }, 400, origin);
  }

  const { data: existing, error: existingErr } = await supabase
    .from("order_reviews")
    .select("id")
    .eq("order_code", orderId)
    .eq("product_id", productId)
    .is("user_id", null)
    .maybeSingle();

  if (existingErr) {
    return json({ error: "Could not check existing review" }, 500, origin);
  }

  const payload = {
    order_code: orderId,
    product_id: productId,
    user_id: null,
    rating,
    comment,
  };

  if (existing?.id) {
    const { error: updateErr } = await supabase
      .from("order_reviews")
      .update(payload)
      .eq("id", existing.id);
    if (updateErr) return json({ error: "Could not update review" }, 500, origin);
  } else {
    const { error: insertErr } = await supabase.from("order_reviews").insert(payload);
    if (insertErr) return json({ error: "Could not submit review" }, 500, origin);
  }

  return json({ ok: true, review: { product_id: productId, rating, comment } }, 200, origin);
});
