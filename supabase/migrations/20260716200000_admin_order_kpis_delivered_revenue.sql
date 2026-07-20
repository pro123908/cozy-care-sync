-- Restricts revenue_sum and shipping_sum in admin_order_kpis() to Delivered
-- orders only, matching the same change just made to product_sales_stats().
--
-- Previously revenue_sum summed total across ALL orders (cancelled included —
-- see 20260716140000's comment on why that was preserved as-is at the time).
-- That's being deliberately changed now: money not yet collected/confirmed
-- (pending/processing/packed/out for delivery) or never collected
-- (cancelled) should not count as revenue. avg_order_value (computed
-- client-side as revenue_sum / a delivered-order count) inherits this
-- automatically.
--
-- total_orders, pending_orders, top_area, top_payment_method, customer counts
-- and status_counts are unchanged — those describe order volume/activity,
-- not money, so the Delivered-only restriction doesn't apply to them.
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
      and status <> 'Cancelled'
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
    'pending_orders',    (select count(*) from o where status not in ('Delivered', 'Cancelled')),
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

revoke all on function public.admin_order_kpis() from public, anon;
grant execute on function public.admin_order_kpis() to authenticated;
