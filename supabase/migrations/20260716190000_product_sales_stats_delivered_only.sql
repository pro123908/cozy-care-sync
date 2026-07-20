-- Restricts product_sales_stats() to Delivered orders only.
--
-- Previously this counted every order except cancelled ones — so a "Total
-- Revenue" / "Total Profit" figure (and /sales page numbers, which share this
-- RPC) included orders still pending, processing, packed, or out for
-- delivery. For COD orders in particular, that money hasn't actually been
-- collected yet; for bank transfer it may not be confirmed. Revenue should
-- only reflect orders that actually completed.
--
-- lower(status) is used (not a plain '=' on 'Delivered') because this
-- codebase has already had one casing mismatch between the storefront and
-- admin app on a status-like field (payment method) — matching case-
-- insensitively here avoids silently under-counting if that ever recurs.
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
  WHERE lower(status) = 'delivered'
  GROUP BY item->>'id';
$$;
