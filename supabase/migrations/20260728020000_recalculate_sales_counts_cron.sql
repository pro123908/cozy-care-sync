-- Nightly safety net for products.sales_count drift after an admin deletes
-- an order (sales_count is incremented in real time when an order is
-- placed, but a later delete doesn't decrement it back down — the existing
-- "Recalculate" button on /sales exists purely to repair that after the
-- fact). Unrelated to delivered_sales_count (storefront's hot-seller
-- ranking), which already stays live via its own trigger and needs no cron.
--
-- Can't just `select public.recalculate_product_sales_counts();` here —
-- that function requires public.is_admin(), which checks auth.uid() and is
-- always NULL in a pg_cron job (no PostgREST/JWT context), so it would
-- raise "Only admins can recalculate sales counts" every run. Rather than
-- touching that function's admin check (used correctly today by the manual
-- button) or adding a confusable second overload, this duplicates its
-- (small, ~15-line) UPDATE logic directly here, run as pg_cron's own role.
create extension if not exists pg_cron;

select cron.schedule(
  'wellcaremart-recalculate-sales-counts',
  '30 20 * * *', -- 20:30 UTC = 01:30 PKT, off-hours
  $$
  WITH item_counts AS (
    SELECT
      item->>'id' AS product_id,
      SUM(GREATEST(COALESCE((item->>'qty')::int, 1), 1))::int AS qty
    FROM public.orders o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(o.items) = 'array' THEN o.items
        ELSE '[]'::jsonb
      END
    ) item
    WHERE COALESCE(item->>'id', '') <> ''
    GROUP BY 1
  )
  UPDATE public.products p
  SET sales_count = COALESCE(ic.qty, 0)
  FROM item_counts ic
  WHERE p.id = ic.product_id;
  $$
);

select cron.schedule(
  'wellcaremart-recalculate-sales-counts-zero-orphans',
  '31 20 * * *', -- one minute after the update above
  $$
  UPDATE public.products p
  SET sales_count = 0
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.orders o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(o.items) = 'array' THEN o.items
        ELSE '[]'::jsonb
      END
    ) item
    WHERE item->>'id' = p.id
  )
  AND p.sales_count <> 0;
  $$
);
