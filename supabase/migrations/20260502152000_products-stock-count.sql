-- Add numeric inventory counts for products and backfill from existing stock labels.

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS stock_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_stock_count_nonnegative;

ALTER TABLE public.products
ADD CONSTRAINT products_stock_count_nonnegative CHECK (stock_count >= 0);

WITH seeded AS (
  SELECT
    p.id,
    p.stock,
    ((get_byte(decode(md5(p.id), 'hex'), 2) << 8) + get_byte(decode(md5(p.id), 'hex'), 3)) AS seed
  FROM public.products p
)
UPDATE public.products p
SET stock_count = CASE
  WHEN seeded.stock = 'Out of stock' THEN 0
  WHEN seeded.stock = 'Low stock' THEN 1 + (seeded.seed % 5)       -- 1..5
  WHEN seeded.stock = 'Limited' THEN 6 + (seeded.seed % 15)        -- 6..20
  ELSE 21 + (seeded.seed % 80)                                     -- 21..100
END,
updated_at = now()
FROM seeded
WHERE p.id = seeded.id;
