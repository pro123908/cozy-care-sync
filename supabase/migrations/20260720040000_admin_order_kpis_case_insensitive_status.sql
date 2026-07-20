-- Fixes an internal inconsistency found during a full calculation audit
-- (2026-07-20): revenue_sum/shipping_sum already matched status
-- case-insensitively (lower(status) = 'delivered'), but pending_orders and
-- the repeat-customer count (cust CTE) still used exact-case comparisons
-- ('Delivered', 'Cancelled') within this SAME function. Every real write path
-- uses canonical casing today, so this was latent, not actively wrong — but
-- a single order ever written with different casing would count toward
-- revenue while being excluded from pending_orders' exclusion list and the
-- customer-frequency count, silently double-counting it as still "pending."
-- status_counts is deliberately left untouched — it's a status-string
-- breakdown for display, not a Delivered/Cancelled predicate.
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
      and lower(status) <> 'cancelled'
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
    'pending_orders',    (select count(*) from o where lower(status) not in ('delivered', 'cancelled')),
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
