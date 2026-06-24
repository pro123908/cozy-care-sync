-- Returns every distinct unit_price a product was sold at, with qty.
-- Used in sales analytics to show historical sale prices vs current price.
CREATE OR REPLACE FUNCTION public.product_price_history()
RETURNS TABLE (
  product_id TEXT,
  unit_price  BIGINT,
  qty_sold    BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    item->>'id'                    AS product_id,
    (item->>'unit_price')::bigint  AS unit_price,
    SUM((item->>'qty')::bigint)    AS qty_sold
  FROM orders,
  LATERAL jsonb_array_elements(items::jsonb) AS item
  WHERE status NOT IN ('cancelled', 'Cancelled')
  GROUP BY item->>'id', (item->>'unit_price')::bigint
  ORDER BY item->>'id', unit_price DESC;
$$;
