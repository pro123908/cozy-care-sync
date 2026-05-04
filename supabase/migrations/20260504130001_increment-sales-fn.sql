-- RPC function to atomically increment a product's sales_count
create or replace function public.increment_product_sales(p_id text, p_qty integer)
returns void
language sql
security definer
as $$
  update public.products
  set sales_count = sales_count + p_qty
  where id = p_id;
$$;
