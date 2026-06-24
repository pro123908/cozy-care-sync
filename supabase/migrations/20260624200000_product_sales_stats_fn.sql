-- Returns per-product sales count and actual revenue using unit_price captured at order time.
-- This ensures revenue figures are correct even when product prices change after an order.
CREATE OR REPLACE FUNCTION public.product_sales_stats()
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
  WHERE status NOT IN ('cancelled', 'Cancelled')
  GROUP BY item->>'id';
$$;
