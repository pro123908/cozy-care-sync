#!/usr/bin/env python3
"""
Second-pass image compression: new missed images + re-compress existing WebPs at q=65.
Uses cwebp -resize to cap dimensions where the rendered size is much smaller than the file.
"""

import os, subprocess, tempfile, requests
from urllib.parse import quote

import os as _os
SUPABASE_URL = "https://dkspvlpswpipltceptoa.supabase.co"
SERVICE_KEY  = _os.environ["SUPABASE_SERVICE_KEY"]
BUCKET       = "product-images"
AUTH_HEADERS = {"Authorization": f"Bearer {SERVICE_KEY}", "apikey": SERVICE_KEY}

# (storage_path, db_table, max_dimension)
# max_dimension: longest side cap in pixels (0 = no resize)
IMAGES = [
    # ── New PNGs we missed in pass 1 ─────────────────────────────────────────
    ("products/po-003-1781541931274.png",       "products",         800),
    ("products/supp-004-1780010105187.png",     "products",         800),
    # ── New JPEGs we missed in pass 1 ────────────────────────────────────────
    ("products/steam-002-1778280627961.jpeg",   "products",         800),
    ("products/ob-014-1779581191993.jpeg",      "products",         800),
    ("products/oth-022-1780183664444.jpeg",     "products",         800),
    ("products/oth-018-1780183767794.jpeg",     "products",         800),
    ("products/hp-008-1781526481531.jpeg",      "products",         800),
    ("products/heat-003-1781533266778.jpeg",    "products",         800),
    ("products/heat-002-1781526499462.jpeg",    "products",         800),
    ("products/heat-007-1781213881022.jpeg",    "products",         800),
    ("products/mas-011-1778072740569.jpeg",     "products",         800),
    ("categories/cat-camote-chairs-53054a3ba8.jpg", "categories",  400),
    ("categories/cat-walkers-1778077188590.jpeg",   "categories",  400),
    # ── Re-compress already-converted WebPs at q=65 ──────────────────────────
    ("homepage-banners/0f156408-6d9b-4aa3-9a29-ae1c2f07d4ed-1781466510834.webp", "homepage_banners", 0),
    ("homepage-banners/86f2ee27-b76b-4525-9bb7-a29340f291a6-1781466342258.webp", "homepage_banners", 0),
    ("homepage-banners/c9d14362-51f1-45d1-8407-497ce3c61fae-1781465910178.webp", "homepage_banners", 0),
    ("categories/cat-other-237c523c59.webp",       "categories",   400),
    ("categories/cat-bp-manual-8321c769fe.webp",   "categories",   400),
    ("categories/cat-bp-digital-12caa7adff.webp",  "categories",   400),
    ("categories/cat-air-mattress-a34444ae0c.webp","categories",   400),
    ("categories/cat-massagers-17e31cc499.webp",   "categories",   400),
    ("categories/cat-ortho-belts-02c6caba03.webp", "categories",   400),
    ("categories/cat-wheelchairs-c12da95fae.webp", "categories",   400),
    ("products/po-001-1781540598472.webp",          "products",     800),
    ("products/heat-001-1778712075474.webp",        "products",     800),
    ("products/sup-006-1780010420593.webp",         "products",     800),
    ("products/bp-dig-005-1778280718447.webp",      "products",     800),
    ("products/bp-dig-001-1617f958ad.webp",         "products",     800),
    ("products/wsd-002-a463b0a863.webp",            "products",     800),
    ("products/steam-006-1780183815214.webp",       "products",     800),
    ("products/mas-006-1778770477689.webp",         "products",     800),
    ("products/oth-023-1779581522287.webp",         "products",     800),
    ("products/oth-013-1780153730187.webp",         "products",     800),
    ("products/gluco-002-1779229647198.webp",       "products",     800),
]

def public_url(path):
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"

def upload_url(path):
    return f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"

def webp_path(path):
    base, _ = os.path.splitext(path)
    return base + ".webp"

def download(url, dest):
    r = requests.get(url, stream=True, timeout=60)
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(65536):
            f.write(chunk)

def get_dimensions(path):
    r = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
                       capture_output=True, text=True)
    w = h = 0
    for line in r.stdout.splitlines():
        if "pixelWidth" in line:
            w = int(line.split()[-1])
        if "pixelHeight" in line:
            h = int(line.split()[-1])
    return w, h

def compress(src, dst, max_dim):
    cmd = ["cwebp", "-q", "65", "-mt"]
    if max_dim > 0:
        w, h = get_dimensions(src)
        if max(w, h) > max_dim:
            # resize so longest side = max_dim
            if w >= h:
                cmd += ["-resize", str(max_dim), "0"]
            else:
                cmd += ["-resize", "0", str(max_dim)]
    cmd += [src, "-o", dst]
    r = subprocess.run(cmd, capture_output=True)
    return r.returncode == 0

def upload(local, storage_path):
    with open(local, "rb") as f:
        data = f.read()
    r = requests.post(
        upload_url(storage_path),
        headers={**AUTH_HEADERS, "Content-Type": "image/webp", "x-upsert": "true"},
        data=data, timeout=120,
    )
    return r.status_code

def patch_db(table, column, old_url, new_url):
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/{table}?{column}=eq.{quote(old_url, safe='')}",
        headers={**AUTH_HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"},
        json={column: new_url}, timeout=30,
    )
    return r.status_code

def process(storage_path, table, tmpdir):
    orig_ext    = os.path.splitext(storage_path)[1].lower()
    new_sp      = webp_path(storage_path)
    orig_url    = public_url(storage_path)
    new_url     = public_url(new_sp)
    local_orig  = os.path.join(tmpdir, os.path.basename(storage_path))
    local_webp  = os.path.join(tmpdir, os.path.basename(new_sp))

    print(f"\n── {os.path.basename(storage_path)}")
    try:
        download(orig_url, local_orig)
    except Exception as e:
        print(f"  ✗ Download: {e}")
        return

    orig_kb = os.path.getsize(local_orig) // 1024
    max_dim = next(d for p, t, d in IMAGES if p == storage_path)

    if not compress(local_orig, local_webp, max_dim):
        print(f"  ✗ cwebp failed")
        return

    new_kb = os.path.getsize(local_webp) // 1024
    saved  = orig_kb - new_kb
    pct    = saved * 100 // orig_kb if orig_kb else 0
    print(f"  {orig_kb}KB → {new_kb}KB  (saved {saved}KB, {pct}%)")

    # Only upload if we actually made it smaller
    if new_kb >= orig_kb:
        print(f"  ⊘ Skipped — not smaller")
        return

    status = upload(local_webp, new_sp)
    if status not in (200, 201):
        print(f"  ✗ Upload failed (HTTP {status})")
        return
    print(f"  ✓ Uploaded")

    # DB update only when extension changed
    if orig_ext != ".webp":
        db_st = patch_db(table, "image_url", orig_url, new_url)
        print(f"  ✓ DB updated ({table}) — HTTP {db_st}")
    else:
        print(f"  ✓ DB unchanged (same URL)")

def main():
    with tempfile.TemporaryDirectory() as tmpdir:
        for storage_path, table, _ in IMAGES:
            process(storage_path, table, tmpdir)
    print("\n✅ Done")

if __name__ == "__main__":
    main()
