#!/usr/bin/env python3
"""
Download large Supabase images, convert to WebP, re-upload, and patch DB records.
"""

import os
import subprocess
import tempfile
import requests
from urllib.parse import quote

import os as _os
SUPABASE_URL = "https://dkspvlpswpipltceptoa.supabase.co"
SERVICE_KEY  = _os.environ["SUPABASE_SERVICE_KEY"]
BUCKET       = "product-images"

AUTH_HEADERS = {
    "Authorization": f"Bearer {SERVICE_KEY}",
    "apikey": SERVICE_KEY,
}

# ── Images to process ────────────────────────────────────────────────────────
# (storage_path, db_table, db_column)
# storage_path is the path inside the bucket (after /product-images/)
IMAGES = [
    # Banners – PNGs (largest impact on LCP)
    ("homepage-banners/0f156408-6d9b-4aa3-9a29-ae1c2f07d4ed-1781466510834.png", "homepage_banners", "image_url"),
    ("homepage-banners/86f2ee27-b76b-4525-9bb7-a29340f291a6-1781466342258.png", "homepage_banners", "image_url"),
    ("homepage-banners/c9d14362-51f1-45d1-8407-497ce3c61fae-1781465910178.png", "homepage_banners", "image_url"),
    # Banner JPEG (already small-ish but still worth it)
    ("homepage-banners/26960f61-1cf3-4aa5-acb8-65b41de28672-1781286262413.jpeg", "homepage_banners", "image_url"),
    # Category images
    ("categories/cat-other-237c523c59.jpg",                 "categories", "image_url"),
    ("categories/cat-wheelchairs-c12da95fae.jpg",           "categories", "image_url"),
    ("categories/cat-sugar-strips-1778076358392.jpeg",      "categories", "image_url"),
    ("categories/cat-bp-manual-8321c769fe.jpg",             "categories", "image_url"),
    ("categories/cat-air-mattress-a34444ae0c.jpg",          "categories", "image_url"),
    ("categories/cat-bp-digital-12caa7adff.jpg",            "categories", "image_url"),
    ("categories/cat-massagers-17e31cc499.jpg",             "categories", "image_url"),
    ("categories/cat-ortho-belts-02c6caba03.jpg",           "categories", "image_url"),
    ("categories/cat-stethoscope-d5ed1ba3f1.jpg",           "categories", "image_url"),
    # Product images
    ("products/heat-001-1778712075474.jpg",     "products", "image_url"),
    ("products/po-001-1781540598472.jpg",       "products", "image_url"),
    ("products/sup-006-1780010420593.jpeg",     "products", "image_url"),
    ("products/bp-dig-005-1778280718447.jpeg",  "products", "image_url"),
    ("products/bp-dig-001-1617f958ad.jpg",      "products", "image_url"),
    ("products/wsd-002-a463b0a863.jpg",         "products", "image_url"),
    ("products/steam-006-1780183815214.jpeg",   "products", "image_url"),
    ("products/mas-006-1778770477689.jpg",      "products", "image_url"),
    ("products/oth-023-1779581522287.jpeg",     "products", "image_url"),
    # Already WebP but poorly compressed
    ("products/oth-013-1780153730187.webp",     "products", "image_url"),
    ("products/gluco-002-1779229647198.webp",   "products", "image_url"),
]

def public_url(storage_path):
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{storage_path}"

def upload_path(storage_path):
    return f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}"

def webp_path(storage_path):
    base, _ = os.path.splitext(storage_path)
    return base + ".webp"

def compress_to_webp(src, dst):
    result = subprocess.run(
        ["cwebp", "-q", "80", "-mt", src, "-o", dst],
        capture_output=True
    )
    return result.returncode == 0

def download(url, dest):
    r = requests.get(url, stream=True, timeout=60)
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(65536):
            f.write(chunk)

def upload_webp(local_path, storage_path):
    with open(local_path, "rb") as f:
        data = f.read()
    r = requests.post(
        upload_path(storage_path),
        headers={**AUTH_HEADERS, "Content-Type": "image/webp", "x-upsert": "true"},
        data=data,
        timeout=120,
    )
    return r.status_code, r.text

def patch_db(table, column, old_url, new_url):
    encoded = quote(old_url, safe="")
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/{table}?{column}=eq.{encoded}",
        headers={**AUTH_HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"},
        json={column: new_url},
        timeout=30,
    )
    return r.status_code

def process(storage_path, table, column, tmpdir):
    orig_url    = public_url(storage_path)
    new_path    = webp_path(storage_path)
    new_url     = public_url(new_path)
    ext         = os.path.splitext(storage_path)[1]
    local_orig  = os.path.join(tmpdir, os.path.basename(storage_path))
    local_webp  = os.path.join(tmpdir, os.path.basename(new_path))

    print(f"\n── {os.path.basename(storage_path)}")

    # Download
    try:
        download(orig_url, local_orig)
    except Exception as e:
        print(f"  ✗ Download failed: {e}")
        return

    orig_kb = os.path.getsize(local_orig) // 1024

    # If already WebP just re-encode it; cwebp handles all formats
    ok = compress_to_webp(local_orig, local_webp)
    if not ok:
        print(f"  ✗ cwebp failed")
        return

    new_kb = os.path.getsize(local_webp) // 1024
    saving = orig_kb - new_kb
    print(f"  {orig_kb}KB → {new_kb}KB  (saved {saving}KB, {saving*100//orig_kb if orig_kb else 0}%)")

    # Upload
    status, body = upload_webp(local_webp, new_path)
    if status not in (200, 201):
        print(f"  ✗ Upload failed ({status}): {body[:200]}")
        return
    print(f"  ✓ Uploaded → {new_url}")

    # Patch DB only if the extension actually changed
    if ext.lower() != ".webp":
        db_status = patch_db(table, column, orig_url, new_url)
        if db_status in (200, 204):
            print(f"  ✓ DB updated ({table}.{column})")
        else:
            print(f"  ✗ DB patch failed (HTTP {db_status})")
    else:
        # Same URL (already webp) – no DB update needed since URL unchanged
        print(f"  ✓ DB unchanged (same URL)")

def main():
    with tempfile.TemporaryDirectory() as tmpdir:
        total_saved = 0
        for storage_path, table, column in IMAGES:
            process(storage_path, table, column, tmpdir)

    print("\n✅ Done")

if __name__ == "__main__":
    main()
