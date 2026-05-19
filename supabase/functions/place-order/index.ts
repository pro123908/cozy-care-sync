import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderItem = { id: string; qty: number; size?: string };

type ShipDetails = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  landmark: string;
};

type RequestBody = {
  items: OrderItem[];
  ship: ShipDetails;
  pay: string;
  promo_code?: string;
};

type ProductRow = { id: string; price: number; active: boolean; stock: string };

// ---------------------------------------------------------------------------
// Promo codes — single source of truth (keep in sync with cart.tsx UI labels)
// ---------------------------------------------------------------------------

const PROMOS: Record<string, number> = {
  WELLCARE10: 0.1,
  HEALTH20: 0.2,
  CARE15: 0.15,
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FREE_SHIPPING_THRESHOLD = 2000;
const SHIPPING_COST = 250;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function generateOrderId(): string {
  return (
    "WCM-" +
    Date.now().toString(36).toUpperCase().slice(-4) +
    Math.random().toString(36).slice(2, 5).toUpperCase()
  );
}

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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  // ------------------------------------------------------------------
  // 1. Verify caller is authenticated using their JWT
  // ------------------------------------------------------------------
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorised" }, 401, origin);
  }
  const jwt = authHeader.slice(7);

  // Use the service-role client to verify the JWT
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authErr,
  } = await serviceClient.auth.getUser(jwt);
  if (authErr || !user) {
    return json({ error: "Unauthorised" }, 401, origin);
  }

  // ------------------------------------------------------------------
  // 2. Parse and validate request body
  // ------------------------------------------------------------------
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  const { items, ship, pay, promo_code } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: "items must be a non-empty array" }, 400, origin);
  }
  for (const item of items) {
    if (typeof item.id !== "string" || !item.id) {
      return json({ error: "Each item must have a string id" }, 400, origin);
    }
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
      return json({ error: `Invalid qty for item ${item.id}` }, 400, origin);
    }
    item.qty = qty; // normalise
  }
  if (!ship?.address || !ship?.city || !ship?.name || !ship?.phone) {
    return json({ error: "Missing required shipping fields" }, 400, origin);
  }
  if (typeof pay !== "string" || !pay) {
    return json({ error: "Missing payment method" }, 400, origin);
  }

  // ------------------------------------------------------------------
  // 3. Fetch product prices from DB (server-side — cannot be tampered)
  // ------------------------------------------------------------------
  const productIds = [...new Set(items.map((i) => i.id))];
  const { data: products, error: productsErr } = await serviceClient
    .from("products")
    .select("id, price, active, stock")
    .in("id", productIds);

  if (productsErr || !products) {
    return json({ error: "Failed to fetch product data" }, 500, origin);
  }

  const productMap = new Map<string, ProductRow>(products.map((p) => [p.id, p]));

  // Validate all products exist and are active
  for (const item of items) {
    const product = productMap.get(item.id);
    if (!product) {
      return json({ error: `Product not found: ${item.id}` }, 400, origin);
    }
    if (!product.active) {
      return json({ error: `Product is no longer available: ${item.id}` }, 400, origin);
    }
  }

  // ------------------------------------------------------------------
  // 4. Re-compute totals server-side
  // ------------------------------------------------------------------
  const subtotal = items.reduce((sum, item) => {
    const product = productMap.get(item.id)!;
    return sum + product.price * item.qty;
  }, 0);

  const shipping = subtotal === 0 ? 0 : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;

  // Validate promo code if provided (it's optional — a missing/invalid code = no discount)
  const promoKey = promo_code?.trim().toUpperCase() ?? "";
  const discountPct = PROMOS[promoKey] ?? 0;
  const discountAmt = Math.round(subtotal * discountPct);
  const total = subtotal + shipping - discountAmt;

  // ------------------------------------------------------------------
  // 5. Insert the order using service-role client
  // ------------------------------------------------------------------
  const orderId = generateOrderId();
  const today = new Date();
  const eta = new Date(today);
  eta.setDate(today.getDate() + 1);

  const orderItems = items.map((item) => ({
    id: item.id,
    qty: item.qty,
    ...(item.size ? { size: item.size } : {}),
  }));

  const { data: insertedOrder, error: insertErr } = await serviceClient
    .from("orders")
    .insert({
      user_id: user.id,
      order_code: orderId,
      placed: fmtDate(today),
      eta: fmtDate(eta),
      status: "Order placed",
      progress: 0,
      address: `${ship.address}, ${ship.city}`,
      phone: ship.phone,
      payment: pay,
      items: orderItems,
      subtotal,
      shipping,
      total,
    })
    .select()
    .single();

  if (insertErr || !insertedOrder) {
    return json({ error: "Failed to create order" }, 500, origin);
  }

  // ------------------------------------------------------------------
  // 6. Increment sales counts
  // ------------------------------------------------------------------
  await Promise.all(
    orderItems.map((item) =>
      serviceClient.rpc("increment_product_sales", { p_id: item.id, p_qty: item.qty }),
    ),
  );

  // ------------------------------------------------------------------
  // 7. Return created order to client
  // ------------------------------------------------------------------
  // Return the actual inserted DB row so callers (and admin UIs) see the same data
  return json(
    {
      order: insertedOrder,
    },
    201,
    origin,
  );
});
