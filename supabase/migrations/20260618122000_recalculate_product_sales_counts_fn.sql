-- Keep product sales analytics in sync after admin deletes orders.

CREATE OR REPLACE FUNCTION public.recalculate_product_sales_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can recalculate sales counts';
  END IF;

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
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_product_sales_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_product_sales_counts() TO authenticated;
