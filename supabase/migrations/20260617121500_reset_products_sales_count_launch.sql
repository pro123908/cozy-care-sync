-- Launch reset: clear historical sales analytics counters
-- This keeps products and orders intact, and only resets sales_count metrics.
UPDATE public.products
SET sales_count = 0
WHERE sales_count <> 0;
