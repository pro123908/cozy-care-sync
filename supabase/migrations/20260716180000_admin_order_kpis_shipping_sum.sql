-- Adds shipping_sum to admin_order_kpis() so the dashboard can show shipping
-- fees collected as its own figure, separate from Total Revenue.
--
-- Total Revenue (product_sales_stats()) is unit_price × qty per line item —
-- it never included shipping, since that RPC also feeds the profit calc
-- (revenue minus cost-of-goods) and shipping has no cost-of-goods to net
-- against. Rather than fold shipping into that number, expose it as its own
-- stat. Scoped the same way as product_sales_stats() (excludes cancelled
-- orders, case-insensitively) so "orders that actually shipped" stays
-- consistent between the two figures.
--
-- Everything else is unchanged from 20260716150000.
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
    'revenue_sum',       (select coalesce(sum(total), 0) from o),
    'shipping_sum',      (select coalesce(sum(shipping), 0) from o where lower(status) <> 'cancelled'),
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
