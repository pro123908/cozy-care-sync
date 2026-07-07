-- Security fix: increment_product_sales was SECURITY DEFINER but executable by
-- PUBLIC. Because it runs as the definer it bypasses the admin-only products
-- UPDATE policy, so any anonymous client could arbitrarily change any product's
-- sales_count (including negative amounts) via
--   supabase.rpc("increment_product_sales", { p_id, p_qty })
-- corrupting best-seller ranking and sales analytics.
--
-- Fix: pin search_path and restrict execution to service_role only. The only
-- legitimate caller is the place-order edge function, which uses the service
-- role key.

create or replace function public.increment_product_sales(p_id text, p_qty integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products
  set sales_count = sales_count + p_qty
  where id = p_id;
$$;

revoke all on function public.increment_product_sales(text, integer) from public, anon, authenticated;
grant execute on function public.increment_product_sales(text, integer) to service_role;
