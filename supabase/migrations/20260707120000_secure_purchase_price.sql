-- Security fix: stop leaking wholesale cost (purchase_price) to the public.
--
-- The "Products are publicly readable" policy grants SELECT on active product
-- rows to anon. RLS is row-level, not column-level, so purchase_price (the
-- store's confidential cost basis) was readable by any anonymous visitor via
--   supabase.from("products").select("purchase_price")
-- exposing margins on the entire catalog.
--
-- Fix: move the cost into a dedicated, admin-only table and drop the column
-- from the public products table. Storefront queries that use select("*") keep
-- working — they simply no longer return the column.

create table if not exists public.product_costs (
  product_id     text primary key references public.products(id) on delete cascade,
  purchase_price integer not null default 0,
  updated_at     timestamptz not null default now()
);

alter table public.product_costs enable row level security;

-- Preserve existing values before dropping the source column.
insert into public.product_costs (product_id, purchase_price)
select id, coalesce(purchase_price, 0)
from public.products
on conflict (product_id) do update set purchase_price = excluded.purchase_price;

-- Admin/staff-only access (matches products management authorization).
drop policy if exists "Admins can read product costs" on public.product_costs;
create policy "Admins can read product costs"
  on public.product_costs for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert product costs" on public.product_costs;
create policy "Admins can insert product costs"
  on public.product_costs for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update product costs" on public.product_costs;
create policy "Admins can update product costs"
  on public.product_costs for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete product costs" on public.product_costs;
create policy "Admins can delete product costs"
  on public.product_costs for delete to authenticated
  using (public.is_admin());

-- Never expose costs to anonymous clients; authenticated access is gated by RLS
-- above, service role is used by backend functions.
revoke all on public.product_costs from anon, public;
grant select, insert, update, delete on public.product_costs to authenticated;
grant all on public.product_costs to service_role;

-- Remove the leaking column from the publicly-readable catalog table.
alter table public.products drop column if exists purchase_price;
