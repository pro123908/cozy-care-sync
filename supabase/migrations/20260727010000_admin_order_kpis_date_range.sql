-- Adds optional p_from/p_to date-range params to admin_order_kpis(), the
-- same treatment 20260726010000 already gave the Sales page's aggregate
-- RPCs — so the admin Dashboard's KPI block (Total Revenue, Total Orders,
-- Pending, Shipping Collected, AOV, top area/payment, repeat customers,
-- status breakdown) can be scoped to the top-nav date range instead of
-- always being all-time. Both params default to null, which reproduces the
-- exact current all-time behavior for a caller that omits them (the only
-- existing caller, app/page.tsx's Dashboard, currently does) — backwards
-- compatible with that usage.
--
-- Every output field derives from the single `o` CTE below, so one added
-- WHERE clause there scopes all of them consistently in one shot,
-- including pending_orders/status_counts — the admin explicitly asked for
-- uniform scoping here (as opposed to Fulfillment's queue, which stays an
-- always-current backlog count on purpose).

create or replace function public.admin_order_kpis(
  p_from timestamptz default null,
  p_to timestamptz default null
)
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
    where (p_from is null or created_at >= p_from)
      and (p_to is null or created_at <= p_to)
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
