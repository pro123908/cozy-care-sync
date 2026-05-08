import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ParsedMessage = {
  name: string;
  categoryRaw?: string;
  brand?: string;
  price?: number;
  stock?: string;
  blurb?: string;
  tags: string[];
};

type CategoryRow = { id: string; name: string; slug: string };
type ProductIdRow = { id: string };
type SortOrderRow = { sort_order: number };
type DuplicateRow = { id: string };

// Green API webhook payload — incomingMessageReceived notification
type GreenApiPayload = {
  typeWebhook: string;
  instanceData: { idInstance: number; wid: string; typeInstance: string };
  timestamp: number;
  idMessage: string;
  senderData: { chatId: string; chatName: string; sender: string; senderName: string };
  messageData: {
    typeMessage: "textMessage" | "imageMessage" | "extendedTextMessage" | string;
    textMessageData?: { textMessage: string };
    imageMessageData?: { downloadUrl: string; caption: string; mimeType: string };
    extendedTextMessageData?: { text: string; description?: string };
  };
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME") || "";
const CLOUDINARY_API_KEY = Deno.env.get("CLOUDINARY_API_KEY") || "";
const CLOUDINARY_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET") || "";
const CLOUDINARY_UPLOAD_FOLDER = Deno.env.get("CLOUDINARY_UPLOAD_FOLDER") || "whatsapp-imports";
const GREEN_API_ID_INSTANCE = Deno.env.get("GREEN_API_ID_INSTANCE") || "";
const GREEN_API_TOKEN = Deno.env.get("GREEN_API_TOKEN") || "";
const WHATSAPP_IMPORT_WEBHOOK_SECRET = Deno.env.get("WHATSAPP_IMPORT_WEBHOOK_SECRET") || "";
const IMPORT_SOURCE_TAG = "import:whatsapp";
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Helpers: Green API
// ---------------------------------------------------------------------------

async function sendGreenApiReply(chatId: string, message: string): Promise<void> {
  if (!GREEN_API_ID_INSTANCE || !GREEN_API_TOKEN) return;
  await fetch(
    `https://api.green-api.com/waInstance${GREEN_API_ID_INSTANCE}/sendMessage/${GREEN_API_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    },
  );
}

async function downloadGreenApiMedia(downloadUrl: string): Promise<Blob> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Green API media download failed (${res.status})`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = await res.arrayBuffer();
  return new Blob([buffer], { type: contentType });
}

// ---------------------------------------------------------------------------
// Helpers: Cloudinary
// ---------------------------------------------------------------------------

function hasCloudinaryConfig() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

async function sha1Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function uploadBlobToCloudinary(blob: Blob, productId: string): Promise<string> {
  if (!hasCloudinaryConfig()) {
    throw new Error(
      "Missing Cloudinary config. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
    );
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = CLOUDINARY_UPLOAD_FOLDER;
  const publicId = `${productId}-${Date.now()}`;
  const signatureBase = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = await sha1Hex(signatureBase);

  const form = new FormData();
  form.append("file", blob, `${productId}.jpg`);
  form.append("api_key", CLOUDINARY_API_KEY);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);
  form.append("public_id", publicId);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: form,
  });
  const json = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    const msg =
      typeof json.error === "object" && json.error && "message" in json.error
        ? String((json.error as { message?: string }).message || "Cloudinary upload failed")
        : "Cloudinary upload failed";
    throw new Error(msg);
  }
  const secureUrl = String(json.secure_url || "").trim();
  if (!secureUrl) throw new Error("Cloudinary response missing secure_url");
  return secureUrl;
}

// ---------------------------------------------------------------------------
// Helpers: category + product ID
// ---------------------------------------------------------------------------

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCategoryPrefix(categorySlug: string) {
  const parts = categorySlug
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (parts.length === 0) return "prd";
  if (parts.length === 1) return parts[0].slice(0, 3);
  return parts
    .map((p) => p[0])
    .join("")
    .slice(0, 4);
}

function getCategoryProductSequence(id: string, prefix: string) {
  const match = new RegExp(`^${prefix}-(\\d+)$`, "i").exec(id.trim());
  return match ? Number(match[1]) : null;
}

async function getNextProductId(categorySlug: string) {
  const prefix = getCategoryPrefix(categorySlug);
  const { data, error } = await supabase.from("products").select("id").eq("cat", categorySlug);
  if (error) throw error;
  const rows = (data || []) as ProductIdRow[];
  const highestSequence = rows.reduce((max, row) => {
    const seq = getCategoryProductSequence(row.id, prefix);
    return seq == null ? max : Math.max(max, seq);
  }, 0);
  const nextSequence = Math.max(rows.length, highestSequence) + 1;
  return `${prefix}-${String(nextSequence).padStart(3, "0")}`;
}

async function getNextSortOrder() {
  const { data, error } = await supabase
    .from("products")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const row = data as SortOrderRow | null;
  return (row?.sort_order || 0) + 1;
}

// ---------------------------------------------------------------------------
// Helpers: tags + deduplication
// ---------------------------------------------------------------------------

function normalizeSenderTag(sender: string) {
  return sender
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

function getImportTags(tags: string[], sender: string) {
  const senderToken = normalizeSenderTag(sender);
  const senderTag = senderToken ? `wa-sender:${senderToken}` : "";
  return Array.from(new Set([...tags, IMPORT_SOURCE_TAG, ...(senderTag ? [senderTag] : [])]));
}

async function findDuplicateImport(name: string, price: number, sender: string) {
  const cutoffIso = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const senderToken = normalizeSenderTag(sender);
  const duplicateTags = senderToken
    ? [IMPORT_SOURCE_TAG, `wa-sender:${senderToken}`]
    : [IMPORT_SOURCE_TAG];
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .ilike("name", name)
    .eq("price", price)
    .contains("tags", duplicateTags)
    .gte("created_at", cutoffIso)
    .limit(1);
  if (error) throw error;
  const rows = (data || []) as DuplicateRow[];
  return rows[0]?.id || null;
}

// ---------------------------------------------------------------------------
// Helpers: message parsing
// ---------------------------------------------------------------------------

function parsePrice(raw: string | undefined) {
  if (!raw) return undefined;
  const numeric = raw.replace(/[^\d.]/g, "");
  if (!numeric) return undefined;
  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.round(parsed));
}

function parseMessage(body: string): ParsedMessage | null {
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let name = "";
  let categoryRaw = "";
  let brand = "";
  let stock = "In stock";
  let blurb = "";
  let price: number | undefined;
  let tags: string[] = [];

  for (const line of lines) {
    const match = line.match(/^([a-zA-Z ]+?)\s*[:=-]\s*(.+)$/);
    if (!match) {
      if (!name) name = line;
      continue;
    }
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (key === "name" || key === "product" || key === "title") {
      name = value;
      continue;
    }
    if (key === "category" || key === "cat") {
      categoryRaw = value;
      continue;
    }
    if (key === "brand") {
      brand = value;
      continue;
    }
    if (key === "price" || key === "amount" || key === "cost") {
      price = parsePrice(value);
      continue;
    }
    if (key === "stock" || key === "availability") {
      stock = value;
      continue;
    }
    if (key === "description" || key === "desc" || key === "blurb") {
      blurb = value;
      continue;
    }
    if (key === "tags" || key === "tag") {
      tags = value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  if (!name) return null;
  return {
    name,
    categoryRaw: categoryRaw || undefined,
    brand: brand || undefined,
    price,
    stock,
    blurb,
    tags,
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  if (!WHATSAPP_IMPORT_WEBHOOK_SECRET) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const providedSecret = req.headers.get("x-webhook-secret") || "";
  if (providedSecret !== WHATSAPP_IMPORT_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as GreenApiPayload | null;

  // Always respond 200 immediately
  const ack = new Response("OK", { status: 200 });

  if (!payload || payload.typeWebhook !== "incomingMessageReceived") return ack;

  const { messageData, senderData } = payload;
  const chatId = senderData?.chatId || "";
  const sender = senderData?.sender || chatId;

  let bodyText = "";
  let imageDownloadUrl: string | null = null;

  if (messageData.typeMessage === "textMessage") {
    bodyText = messageData.textMessageData?.textMessage || "";
  } else if (messageData.typeMessage === "imageMessage") {
    imageDownloadUrl = messageData.imageMessageData?.downloadUrl || null;
    bodyText = messageData.imageMessageData?.caption || "";
  } else if (messageData.typeMessage === "extendedTextMessage") {
    bodyText = messageData.extendedTextMessageData?.text || "";
  } else {
    return ack; // unsupported type
  }

  const parsed = parseMessage(bodyText.trim());

  if (!parsed) {
    await sendGreenApiReply(
      chatId,
      "Couldn't parse product. Please send:\nName: ...\nCategory: ...\nPrice: ...\nBrand: ...\nStock: ...\nDescription: ...\nTags: ...\n\nAttach the product image to the same message.",
    );
    return ack;
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, slug");

  if (categoriesError) {
    await sendGreenApiReply(chatId, "Server error loading categories. Please try again later.");
    return ack;
  }

  const allCategories = (categories || []) as CategoryRow[];
  const fallbackCategory = allCategories.find((c) => c.slug === "other") || null;
  const desiredSlug = parsed.categoryRaw ? toSlug(parsed.categoryRaw) : "";
  const desiredName = parsed.categoryRaw?.trim().toLowerCase() || "";
  const matchedCategory =
    allCategories.find((c) => c.slug === desiredSlug) ||
    allCategories.find((c) => c.name.trim().toLowerCase() === desiredName) ||
    fallbackCategory;
  const categorySlug = matchedCategory?.slug || "other";
  const categoryId = matchedCategory?.id || null;

  try {
    const duplicateProductId = await findDuplicateImport(parsed.name, parsed.price ?? 0, sender);
    if (duplicateProductId) {
      await sendGreenApiReply(
        chatId,
        `Duplicate ignored. A draft for this product already exists: ${duplicateProductId}.`,
      );
      return ack;
    }

    const [nextId, nextSortOrder] = await Promise.all([
      getNextProductId(categorySlug),
      getNextSortOrder(),
    ]);

    let imageUrl: string | null = null;
    let imageUploadWarning: string | null = null;
    if (imageDownloadUrl) {
      try {
        const blob = await downloadGreenApiMedia(imageDownloadUrl);
        imageUrl = await uploadBlobToCloudinary(blob, nextId);
      } catch (err) {
        imageUploadWarning = err instanceof Error ? err.message : "Could not upload image";
      }
    }

    const { error: insertError } = await supabase.from("products").insert({
      id: nextId,
      name: parsed.name,
      brand: parsed.brand || "",
      cat: categorySlug,
      category_id: categoryId,
      price: parsed.price ?? 0,
      stock: parsed.stock || "In stock",
      tags: getImportTags(parsed.tags, sender),
      blurb: parsed.blurb || "Imported from WhatsApp",
      swatch: "emerald",
      image_url: imageUrl,
      sort_order: nextSortOrder,
      active: false,
    });

    if (insertError) throw insertError;

    await sendGreenApiReply(
      chatId,
      imageUploadWarning
        ? `Draft created: ${nextId}. Image upload failed — please add the image in admin.`
        : `Draft created: ${nextId}. Review and activate it in admin.`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await sendGreenApiReply(chatId, `Failed to import product: ${message}`);
  }

  return ack;
});
