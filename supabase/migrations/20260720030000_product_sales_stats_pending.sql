-- Companion to product_sales_stats() (Delivered-only) — this variant scopes
-- to orders still in the pipeline (not yet Delivered, not Cancelled), so the
-- admin Sales page can show a "if all current orders get delivered" revenue
-- projection alongside the actual (Delivered-only) Total Revenue/Profit.
--
-- Same historical-price methodology as product_sales_stats(): revenue is
-- qty * unit_price as captured on the order's own items JSONB at order time,
-- not the product's current price. No SECURITY DEFINER — same as
-- product_sales_stats(), runs under the caller's own RLS.
CREATE OR REPLACE FUNCTION public.product_sales_stats_pending()
RETURNS TABLE (
  product_id  TEXT,
  sales_count BIGINT,
  total_revenue BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    item->>'id'                                                         AS product_id,
    SUM((item->>'qty')::bigint)                                         AS sales_count,
    SUM((item->>'qty')::bigint * (item->>'unit_price')::bigint)         AS total_revenue
  FROM orders,
  LATERAL jsonb_array_elements(items::jsonb) AS item
  WHERE lower(status) NOT IN ('delivered', 'cancelled')
  GROUP BY item->>'id';
$$;
