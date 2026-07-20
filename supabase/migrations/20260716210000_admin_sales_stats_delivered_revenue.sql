-- Restricts admin_sales_stats() revenue figures to Delivered orders only,
-- matching the same change made to product_sales_stats() and
-- admin_order_kpis(): money isn't real until an order is actually delivered
-- (COD cash uncollected, bank transfer unconfirmed for anything still
-- pending/processing/packed/out for delivery).
--
-- Scope, mirroring the dashboard's convention:
--   * revenue_sum, avg_order_value's numerator, and the `revenue` field inside
--     revenue_by_month/revenue_by_week now come from Delivered orders only.
--   * delivered_order_count is new — the client needs it as the denominator
--     for avg order value (revenue / delivered orders), not total orders,
--     same fix already applied on the main dashboard.
--   * total_order_count, first_order_at, total_customers, repeat_customers,
--     freq1/2/3plus, and the `orders` field inside revenue_by_month/week are
--     UNCHANGED (still all non-cancelled orders) — those describe order
--     volume/customer activity, not money.
create or replace function public.admin_sales_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
  tz constant text := 'Asia/Karachi';
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  with active as (
    select
      coalesce(total, 0) as total,
      status,
      (created_at at time zone tz) as local_ts,
      created_at,
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
    where status not in ('cancelled', 'Cancelled')
  ),
  delivered as (
    select total, local_ts from active where lower(status) = 'delivered'
  ),
  month_orders as (
    select to_char(local_ts, 'YYYY-MM') as key, count(*) as orders
    from active group by 1
  ),
  month_revenue as (
    select to_char(local_ts, 'YYYY-MM') as key, sum(total) as revenue
    from delivered group by 1
  ),
  by_month as (
    select mo.key as key, coalesce(mr.revenue, 0) as revenue, mo.orders as orders
    from month_orders mo
    left join month_revenue mr using (key)
  ),
  week_orders as (
    -- Sunday-start week key (local), as ISO date string, matching the JS
    -- weekStart.toISOString().slice(0,10).
    select (local_ts::date - extract(dow from local_ts)::int)::text as key,
           count(*) as orders
    from active group by 1
  ),
  week_revenue as (
    select (local_ts::date - extract(dow from local_ts)::int)::text as key,
           sum(total) as revenue
    from delivered group by 1
  ),
  by_week as (
    select wo.key as key, coalesce(wr.revenue, 0) as revenue, wo.orders as orders
    from week_orders wo
    left join week_revenue wr using (key)
  ),
  cust as (
    select customer_key, count(*) as n
    from active where customer_key is not null group by customer_key
  )
  select json_build_object(
    'total_order_count',    (select count(*) from active),
    'delivered_order_count',(select count(*) from delivered),
    'revenue_sum',          (select coalesce(sum(total), 0) from delivered),
    'first_order_at',       (select min(created_at) from active),
    'revenue_by_month',     (
      select coalesce(json_agg(json_build_object('key', key, 'revenue', revenue, 'orders', orders)
                               order by key), '[]'::json)
      from by_month
    ),
    'revenue_by_week',      (
      select coalesce(json_agg(json_build_object('key', key, 'revenue', revenue, 'orders', orders)
                               order by key), '[]'::json)
      from by_week
    ),
    'total_customers',      (select count(*) from cust),
    'repeat_customers',     (select count(*) from cust where n > 1),
    'freq1',                (select count(*) from cust where n = 1),
    'freq2',                (select count(*) from cust where n = 2),
    'freq3plus',            (select count(*) from cust where n >= 3)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_sales_stats() from public, anon;
grant execute on function public.admin_sales_stats() to authenticated;

comment on function public.admin_sales_stats() is
  'Revenue buckets + customer frequency for the Sales page. Revenue figures are Delivered-only; order/customer counts remain all non-cancelled orders.';
