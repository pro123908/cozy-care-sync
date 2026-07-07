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
  meta?: { fbc?: string; fbp?: string };
};

type SizeOption = { size: string; price: number };
type VariantOption = { name: string; price: number };
type ProductRow = {
  id: string;
  price: number;
  active: boolean;
  stock: string;
  size_options?: SizeOption[] | null;
  variant_options?: VariantOption[] | null;
};

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
const MAX_QTY_PER_PRODUCT = 5;
const META_PIXEL_ID = Deno.env.get("META_PIXEL_ID") || "2002828427034307";
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || "";
const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v20.0";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ORDER_NOTIFY_FROM = Deno.env.get("ORDER_NOTIFY_FROM") || "Well Care Mart <onboarding@resend.dev>";
const ORDER_NOTIFY_EMAIL = Deno.env.get("ORDER_NOTIFY_EMAIL") || "";

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

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function summarizeMetaResponse(metaResponse: unknown) {
  if (!metaResponse || typeof metaResponse !== "object") return { raw: metaResponse };
  const response = metaResponse as Record<string, unknown>;
  return {
    events_received: response.events_received,
    messages: response.messages,
    fbtrace_id: response.fbtrace_id,
    raw: metaResponse,
  };
}

// Track recent Purchase values to help detect if all events have identical values
const recentPurchaseValues: number[] = [];
const MAX_RECENT = 10;

function logPurchaseValueTrend(value: number): void {
  recentPurchaseValues.push(value);
  if (recentPurchaseValues.length > MAX_RECENT) {
    recentPurchaseValues.shift();
  }
  const uniqueValues = new Set(recentPurchaseValues).size;
  if (recentPurchaseValues.length >= 3 && uniqueValues === 1) {
    console.warn("[meta-capi] Purchase values suspiciously identical", {
      recentValues: recentPurchaseValues,
      uniqueCount: uniqueValues,
      note: "All recent Purchase events have the same value. Vary test orders (different items, qty, or promos) to verify tracking.",
    });
  }
}

async function sendMetaPurchaseEvent(input: {
  orderId: string;
  total: number;
  numItems: number;
  itemIds: string[];
  email?: string;
  phone?: string;
  fbc?: string;
  fbp?: string;
  userAgent: string;
  clientIp: string;
  eventSourceUrl: string;
}) {
  const purchaseValue = Number(input.total.toFixed(2));
  if (!Number.isFinite(purchaseValue) || purchaseValue <= 0) {
    console.warn("[meta-capi] skipping Purchase with invalid value", {
      eventName: "Purchase",
      eventId: input.orderId,
      value: purchaseValue,
    });
    return;
  }

  if (!Array.isArray(input.itemIds) || input.itemIds.length === 0) {
    console.warn("[meta-capi] skipping Purchase with empty content_ids", {
      eventName: "Purchase",
      eventId: input.orderId,
    });
    return;
  }

  if (!Number.isFinite(input.numItems) || input.numItems < 1) {
    console.warn("[meta-capi] skipping Purchase with invalid num_items", {
      eventName: "Purchase",
      eventId: input.orderId,
      numItems: input.numItems,
    });
    return;
  }

  console.info("[meta-capi] incoming event", {
    eventName: "Purchase",
    eventId: input.orderId,
    contentIds: input.itemIds,
    numItems: input.numItems,
    value: purchaseValue,
    currency: "PKR",
    hasUserEmail: Boolean(input.email),
    hasUserPhone: Boolean(input.phone),
  });

  logPurchaseValueTrend(purchaseValue);

  if (!META_ACCESS_TOKEN || !META_PIXEL_ID) {
    console.info(
      "[meta-capi] missing META_ACCESS_TOKEN or META_PIXEL_ID - skipping Purchase event",
    );
    return;
  }

  const em = input.email ? normalizeEmail(input.email) : "";
  const ph = input.phone ? normalizePhone(input.phone) : "";

  const userData: Record<string, unknown> = {
    client_user_agent: input.userAgent,
    client_ip_address: input.clientIp,
  };

  if (em) userData.em = [await sha256Hex(em)];
  if (ph) userData.ph = [await sha256Hex(ph)];
  if (input.fbc) userData.fbc = input.fbc;
  if (input.fbp) userData.fbp = input.fbp;

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.orderId,
        action_source: "website",
        event_source_url: input.eventSourceUrl,
        user_data: userData,
        custom_data: {
          currency: "PKR",
          value: purchaseValue,
          content_type: "product",
          content_ids: input.itemIds,
          num_items: input.numItems,
          order_id: input.orderId,
        },
      },
    ],
  };

  const endpoint = `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[meta-capi] event failed", {
      eventName: "Purchase",
      eventId: input.orderId,
      status: res.status,
      response: txt,
    });
    return;
  }

  const metaResponse = await res.json().catch(() => null);
  console.info("[meta-capi] meta response summary", {
    eventName: "Purchase",
    eventId: input.orderId,
    summary: summarizeMetaResponse(metaResponse),
  });
  console.info("[meta-capi] event sent", {
    eventName: "Purchase",
    eventId: input.orderId,
    value: purchaseValue,
    numItems: input.numItems,
    metaResponse,
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

async function sendOrderNotificationEmail(input: {
  orderId: string;
  ship: ShipDetails;
  pay: string;
  items: Array<{ id: string; qty: number; size?: string; unit_price: number }>;
  subtotal: number;
  shipping: number;
  total: number;
}) {
  if (!RESEND_API_KEY || !ORDER_NOTIFY_EMAIL) {
    console.info("[order-email] missing RESEND_API_KEY or ORDER_NOTIFY_EMAIL - skipping notification");
    return;
  }

  const recipients = ORDER_NOTIFY_EMAIL.split(",").map((e) => e.trim()).filter(Boolean);
  if (recipients.length === 0) return;

  const rows = input.items
    .map(
      (item, i) =>
        `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#fafaf7"}">` +
        `<td style="padding:10px 12px;border-bottom:1px solid #eeece5;color:#1e293b;font-size:14px">${escapeHtml(item.id)}${item.size ? ` <span style="color:#64748b">(${escapeHtml(item.size)})</span>` : ""}</td>` +
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
                <span style="color:#cbd5e1;font-size:13px">New order notification</span>
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
                <div style="font-size:20px;font-weight:700;color:#0f172a">Order ${escapeHtml(input.orderId)}</div>
                <div style="font-size:13px;color:#64748b;margin-top:2px">Payment: ${escapeHtml(input.pay)}</div>
              </td>
              <td style="text-align:right;vertical-align:top">
                <span style="display:inline-block;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px">Order placed</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 28px">
          <div style="background:#fafaf7;border:1px solid #eeece5;border-radius:12px;padding:14px 16px">
            <div style="font-size:14px;font-weight:600;color:#1e293b">${escapeHtml(input.ship.name)}</div>
            <div style="font-size:13px;color:#475569;margin-top:4px">${escapeHtml(input.ship.phone)} · ${escapeHtml(input.ship.email)}</div>
            <div style="font-size:13px;color:#475569;margin-top:4px">${escapeHtml(input.ship.address)}, ${escapeHtml(input.ship.city)}${input.ship.landmark ? ` (${escapeHtml(input.ship.landmark)})` : ""}</div>
          </div>
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
                  <tr><td style="padding:2px 0">Subtotal</td><td style="text-align:right">Rs ${input.subtotal.toLocaleString()}</td></tr>
                  <tr><td style="padding:2px 0">Shipping</td><td style="text-align:right">${input.shipping === 0 ? "Free" : `Rs ${input.shipping.toLocaleString()}`}</td></tr>
                  <tr><td style="padding:8px 0 0;font-size:16px;font-weight:700;color:#0f172a">Total</td><td style="text-align:right;padding:8px 0 0;font-size:16px;font-weight:700;color:#0f172a">Rs ${input.total.toLocaleString()}</td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px">
          <a href="https://wellcaremart.pk/admin/orders" style="display:block;text-align:center;background:linear-gradient(135deg,#2563eb,#10b981);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px;border-radius:10px">View in admin panel</a>
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
        to: recipients,
        subject: `New order ${input.orderId} - Rs ${input.total}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[order-email] send failed", { status: res.status, body: await res.text().catch(() => "") });
    }
  } catch (err) {
    console.error("[order-email] send threw", err);
  }
}

function normalizeSizeOptions(options?: SizeOption[] | null): SizeOption[] {
  if (!Array.isArray(options)) return [];
  const seen = new Set<string>();
  const normalized: SizeOption[] = [];
  for (const option of options) {
    const size = typeof option?.size === "string" ? option.size.trim() : "";
    const price = Number(option?.price);
    const key = size.toLowerCase();
    if (!size || !Number.isFinite(price) || price < 0 || seen.has(key)) continue;
    seen.add(key);
    normalized.push({ size, price: Math.round(price) });
  }
  return normalized;
}

function normalizeVariantOptions(options?: VariantOption[] | null): VariantOption[] {
  if (!Array.isArray(options)) return [];
  const seen = new Set<string>();
  const normalized: VariantOption[] = [];
  for (const option of options) {
    const name = typeof option?.name === "string" ? option.name.trim() : "";
    const price = Number(option?.price);
    const key = name.toLowerCase();
    if (!name || !Number.isFinite(price) || price < 0 || seen.has(key)) continue;
    seen.add(key);
    normalized.push({ name, price: Math.round(price) });
  }
  return normalized;
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
  // 1. Optionally verify caller JWT (guest checkout is allowed)
  // ------------------------------------------------------------------
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const jwt = authHeader.slice(7);
    const {
      data: { user },
      error: authErr,
    } = await serviceClient.auth.getUser(jwt);

    // If token is invalid/expired, gracefully continue as guest checkout.
    if (!authErr && user) {
      userId = user.id;
    }
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

  const { items, ship, pay, promo_code, meta } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: "items must be a non-empty array" }, 400, origin);
  }
  for (const item of items) {
    if (typeof item.id !== "string" || !item.id) {
      return json({ error: "Each item must have a string id" }, 400, origin);
    }
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_PRODUCT) {
      return json({ error: `Invalid qty for item ${item.id}` }, 400, origin);
    }
    item.qty = qty; // normalise
  }
  if (!ship?.address || !ship?.city || !ship?.name || !ship?.phone || !ship?.email) {
    return json({ error: "Missing required shipping fields" }, 400, origin);
  }

  const normalizedEmail = normalizeEmail(ship.email);
  if (!isValidEmail(normalizedEmail)) {
    return json({ error: "Invalid email" }, 400, origin);
  }
  ship.email = normalizedEmail;

  if (typeof pay !== "string" || !pay) {
    return json({ error: "Missing payment method" }, 400, origin);
  }

  // ------------------------------------------------------------------
  // 3. Fetch product prices from DB (server-side — cannot be tampered)
  // ------------------------------------------------------------------
  const productIds = [...new Set(items.map((i) => i.id))];
  const { data: products, error: productsErr } = await serviceClient
    .from("products")
    .select("id, price, active, stock, size_options, variant_options")
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
  const pricedItems = items.map((item) => {
    const product = productMap.get(item.id)!;
    const variantOptions = normalizeVariantOptions(product.variant_options);
    const sizeOptions = normalizeSizeOptions(product.size_options);
    const selectableOptions =
      variantOptions.length > 0
        ? variantOptions.map((option) => ({ label: option.name, price: option.price }))
        : sizeOptions.map((option) => ({ label: option.size, price: option.price }));
    let unitPrice = product.price;

    if (selectableOptions.length > 0) {
      if (!item.size || !item.size.trim()) {
        return { error: `Please select an option for ${item.id}` } as const;
      }
      const selected = sizeOptions.find(
        (option) => option.size.toLowerCase() === item.size!.trim().toLowerCase(),
      );
      const selectedVariant = variantOptions.find(
        (option) => option.name.toLowerCase() === item.size!.trim().toLowerCase(),
      );
      const resolvedSelection = selectedVariant || selected;
      if (!resolvedSelection) {
        return { error: `Invalid size selected for ${item.id}` } as const;
      }
      unitPrice = resolvedSelection.price;
      item.size = "name" in resolvedSelection ? resolvedSelection.name : resolvedSelection.size;
    }

    return {
      id: item.id,
      qty: item.qty,
      ...(item.size ? { size: item.size } : {}),
      unit_price: unitPrice,
      line_total: unitPrice * item.qty,
    };
  });

  const pricingError = pricedItems.find((item) => "error" in item);
  if (pricingError && "error" in pricingError) {
    return json({ error: pricingError.error }, 400, origin);
  }

  const finalizedItems = pricedItems as Array<{
    id: string;
    qty: number;
    size?: string;
    unit_price: number;
    line_total: number;
  }>;

  const subtotal = finalizedItems.reduce((sum, item) => sum + item.line_total, 0);

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

  const orderItems = finalizedItems.map((item) => ({
    id: item.id,
    qty: item.qty,
    ...(item.size ? { size: item.size } : {}),
    unit_price: item.unit_price,
  }));

  const { error: insertErr } = await serviceClient.from("orders").insert({
    user_id: userId,
    customer_name: ship.name.trim(),
    landmark: ship.landmark?.trim() || null,
    email: ship.email,
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
  });

  if (insertErr) {
    return json({ error: "Failed to create order" }, 500, origin);
  }

  // ------------------------------------------------------------------
  // 5b. Notify admin of the new order by email (best-effort)
  // ------------------------------------------------------------------
  await sendOrderNotificationEmail({
    orderId,
    ship,
    pay,
    items: orderItems,
    subtotal,
    shipping,
    total,
  });

  // ------------------------------------------------------------------
  // 6. Increment sales counts
  // ------------------------------------------------------------------
  await Promise.all(
    orderItems.map((item) =>
      serviceClient.rpc("increment_product_sales", { p_id: item.id, p_qty: item.qty }),
    ),
  );

  // ------------------------------------------------------------------
  // 7. Send server-side Purchase event via Meta Conversions API
  // ------------------------------------------------------------------
  const clientIp = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "";
  const userAgent = req.headers.get("user-agent") || "";
  const eventSourceUrl = req.headers.get("origin") || req.url;
  const numItems = orderItems.reduce((sum, item) => sum + Math.max(1, Number(item.qty) || 1), 0);
  const itemIds = [...new Set(orderItems.map((item) => item.id).filter(Boolean))];

  await sendMetaPurchaseEvent({
    orderId,
    total,
    numItems,
    itemIds,
    email: ship.email,
    phone: ship.phone,
    fbc: meta?.fbc,
    fbp: meta?.fbp,
    userAgent,
    clientIp,
    eventSourceUrl,
  });

  // ------------------------------------------------------------------
  // 8. Return created order to client
  // ------------------------------------------------------------------
  return json(
    {
      order: {
        id: orderId,
        placed: fmtDate(today),
        eta: fmtDate(eta),
        status: "Order placed",
        progress: 0,
        customer_name: ship.name.trim(),
        landmark: ship.landmark?.trim() || null,
        address: `${ship.address}, ${ship.city}`,
        phone: ship.phone,
        email: ship.email,
        payment: pay,
        items: orderItems,
        subtotal,
        shipping,
        total,
      },
    },
    201,
    origin,
  );
});
