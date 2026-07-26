-- New order status: "Returned" — for parcels refused/returned by the
-- customer (see courier_bookings.status_history "Ready for Return - REFUSED
-- WITH NO REASON"). orders.status has always been a free-text column (no
-- CHECK constraint/enum) so this needs no schema change — just wiring the
-- new value into the same places 'Cancelled' already gets special treatment:
--
--   - Restricting the transition to the super admin, same as Cancelled
--     (both are consequential, semi-irreversible status changes that
--     release reserved stock back to sellable inventory).
--   - Excluding Returned orders from "pending/outstanding" counts, same as
--     Cancelled — otherwise a returned order sits in KPIs forever looking
--     like it still needs fulfillment action.
--
-- Deliberately NOT touching order_status_holds_stock() — Returned staying
-- out of its allow-list means the existing generic was_held/is_held trigger
-- (orders_adjust_stock_on_status_change) already restocks automatically the
-- moment an order moves from any held status (e.g. Delivered, Out for
-- delivery) to Returned. No trigger changes needed for that part.

-- Only the super admin may transition an order's status to 'Returned' (same
-- restriction as 'Cancelled', same reasoning: consequential + releases
-- reserved stock).
drop policy if exists "Admins can update all orders" on public.orders;
create policy "Admins can update all orders"
on public.orders
for update
to authenticated
using (public.is_admin())
with check (
  public.is_admin()
  and (status not in ('Cancelled', 'Returned') or public.is_super_admin())
);

create or replace function public.admin_order_kpis()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  with o as (
    select
      status,
      coalesce(total, 0) as total,
      coalesce(shipping, 0) as shipping,
      nullif(trim(coalesce(city, '')), '') as city,
      nullif(trim(coalesce(payment, '')), '') as payment,
      nullif(
        lower(trim(
          case
            when coalesce(phone, '') <> '' then phone
            when coalesce(email, '') <> '' then email
            else ''
          end
        )),
        ''
      ) as customer_key
    from orders
  ),
  cust as (
    select customer_key, count(*) as n
    from o
    where customer_key is not null
      and lower(status) not in ('cancelled', 'returned')
    group by customer_key
  ),
  top_city as (
    select city from o where city is not null
    group by city order by count(*) desc, city asc limit 1
  ),
  top_pay as (
    select payment, count(*) as n from o where payment is not null
    group by payment order by count(*) desc, payment asc limit 1
  ),
  statuses as (
    select status, count(*) as n from o group by status
  )
  select json_build_object(
    'total_orders',      (select count(*) from o),
    'pending_orders',    (select count(*) from o where lower(status) not in ('delivered', 'cancelled', 'returned')),
    'revenue_sum',       (select coalesce(sum(total), 0) from o where lower(status) = 'delivered'),
    'shipping_sum',      (select coalesce(sum(shipping), 0) from o where lower(status) = 'delivered'),
    'top_area',          (select city from top_city),
    'top_payment_method',(select payment from top_pay),
    'top_payment_count', (select n from top_pay),
    'total_customers',   (select count(*) from cust),
    'repeat_customers',  (select count(*) from cust where n > 1),
    'status_counts',     (select coalesce(json_object_agg(status, n), '{}'::json) from statuses)
  ) into result;

  return result;
end;
$$;

create or replace function public.product_sales_stats_pending()
returns table(product_id text, sales_count bigint, total_revenue bigint)
language sql
stable
as $$
  select
    item->>'id' as product_id,
    sum((item->>'qty')::bigint) as sales_count,
    sum((item->>'qty')::bigint * (item->>'unit_price')::bigint) as total_revenue
  from orders,
  lateral jsonb_array_elements(items::jsonb) as item
  where lower(status) not in ('delivered', 'cancelled', 'returned')
  group by item->>'id';
$$;
