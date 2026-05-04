#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function printHelp() {
  console.log(`
Cloudinary -> Supabase Storage migration

Required env:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Optional env:
  SUPABASE_BUCKET (default: product-images)
  STORE_MODE (public-url | object-path, default: public-url)

Flags:
  --table <name>           Table to read/update (default: products)
  --idColumn <name>        Primary key column (default: id)
  --imageColumn <name>     Image URL/path column (default: image_url)
  --bucket <name>          Storage bucket (default: product-images)
  --limit <number>         Max rows to scan (default: 1000)
  --store <mode>           public-url or object-path
  --dry-run                Download only; no upload/update
  --help                   Show this help

Examples:
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-cloudinary-to-supabase.mjs --dry-run
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-cloudinary-to-supabase.mjs --store object-path
`);
}

function resolveStoreValue(mode, supabase, bucket, objectPath) {
  if (mode === "object-path") return objectPath;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return urlData.publicUrl;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function guessExt(contentType, url) {
  if (contentType?.includes("image/jpeg")) return "jpg";
  if (contentType?.includes("image/png")) return "png";
  if (contentType?.includes("image/webp")) return "webp";
  if (contentType?.includes("image/avif")) return "avif";
  if (contentType?.includes("image/gif")) return "gif";
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").pop() || "";
    const ext = last.split(".").pop();
    if (ext && ext.length <= 5) return ext.toLowerCase();
  } catch {
    // noop
  }
  return "jpg";
}

function buildObjectPath(table, rowId, sourceUrl, ext) {
  const digest = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 10);
  return `${table}/${rowId}-${digest}.${ext}`;
}

function isCloudinaryUrl(value) {
  return typeof value === "string" && /^https?:\/\/res\.cloudinary\.com\//i.test(value.trim());
}

async function fetchImage(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status} ${res.statusText})`);
  }
  const bytes = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { body: Buffer.from(bytes), contentType };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const table = args.table || "products";
  const idColumn = args.idColumn || "id";
  const imageColumn = args.imageColumn || "image_url";
  const bucket = args.bucket || process.env.SUPABASE_BUCKET || "product-images";
  const rowLimit = Number(args.limit || 1000);
  const storeMode = args.store || process.env.STORE_MODE || "public-url";
  const dryRun = Boolean(args["dry-run"]);

  if (storeMode !== "public-url" && storeMode !== "object-path") {
    throw new Error("Invalid --store value. Use public-url or object-path.");
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  console.log(`Reading ${table}.${imageColumn} (limit=${rowLimit})`);

  const { data: rows, error: selectError } = await supabase
    .from(table)
    .select(`${idColumn}, ${imageColumn}`)
    .limit(rowLimit);

  if (selectError) {
    throw new Error(`Failed to query table: ${selectError.message}`);
  }

  const candidates = (rows || []).filter((r) => isCloudinaryUrl(r[imageColumn]));

  if (candidates.length === 0) {
    console.log("No Cloudinary URLs found. Nothing to migrate.");
    return;
  }

  console.log(`Found ${candidates.length} Cloudinary image(s) to migrate.`);
  console.log(`Store mode: ${storeMode}`);
  if (dryRun) {
    console.log("Dry-run enabled: no uploads or DB updates will be performed.");
  }

  let ok = 0;
  let fail = 0;

  for (const row of candidates) {
    const rowId = row[idColumn];
    const sourceUrl = String(row[imageColumn]).trim();

    try {
      const { body, contentType } = await fetchImage(sourceUrl);
      const ext = guessExt(contentType, sourceUrl);
      const objectPath = buildObjectPath(table, rowId, sourceUrl, ext);

      if (!dryRun) {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(objectPath, body, {
            contentType,
            upsert: true,
            cacheControl: "31536000",
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        const targetValue = resolveStoreValue(storeMode, supabase, bucket, objectPath);

        const { error: updateError } = await supabase
          .from(table)
          .update({ [imageColumn]: targetValue })
          .eq(idColumn, rowId);

        if (updateError) {
          throw new Error(`DB update failed: ${updateError.message}`);
        }
      }

      ok += 1;
      console.log(`[OK] ${rowId} -> ${bucket}/${objectPath}`);
    } catch (err) {
      fail += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[FAIL] ${rowId} (${sourceUrl}) :: ${message}`);
    }
  }

  console.log(`Done. Success=${ok}, Failed=${fail}, Total=${candidates.length}`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Fatal: ${message}`);
  process.exit(1);
});
