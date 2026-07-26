-- Adds optional p_from/p_to date-range params to the Sales page's core
-- aggregate RPCs, so the page's Overview/Analytics/Leaderboards/Inventory/
-- Customers/Reviews tabs can all be scoped to an arbitrary period via one
-- shared DateRangePicker (matching the calendar picker already used on
-- /orders), instead of always being all-time. Both params default to null,
-- which reproduces the exact current all-time behavior for a caller that
-- omits them — so this is backwards compatible with every existing usage.
-- The Reports tab (Net Profit Report) already has its own independent
-- from/to picker querying `orders` directly and is untouched here.

create or replace function public.product_sales_stats(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table(product_id text, sales_count bigint, total_revenue bigint)
language sql
stable
as $$
  SELECT
    item->>'id'                                                         AS product_id,
    SUM((item->>'qty')::bigint)                                         AS sales_count,
    SUM((item->>'qty')::bigint * (item->>'unit_price')::bigint)         AS total_revenue
  FROM orders,
  LATERAL jsonb_array_elements(items::jsonb) AS item
  WHERE lower(status) = 'delivered'
    AND (p_from IS NULL OR created_at >= p_from)
    AND (p_to IS NULL OR created_at <= p_to)
  GROUP BY item->>'id';
$$;

create or replace function public.product_sales_stats_pending(
  p_from timestamptz default null,
  p_to timestamptz default null
)
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
    and (p_from is null or created_at >= p_from)
    and (p_to is null or created_at <= p_to)
  group by item->>'id';
$$;

-- Same shape as the 20260718030000 Delivered-only rewrite, with p_from/p_to
-- narrowing the base `active` scan (which "delivered" already inherits,
-- since "active" is itself Delivered-only as of that migration).
create or replace function public.admin_sales_stats(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  result json;
  tz constant text := 'Asia/Karachi';
begin
  if not (public.is_admin() or public.is_viewer()) then
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
    where lower(status) = 'delivered'
      and (p_from is null or created_at >= p_from)
      and (p_to is null or created_at <= p_to)
  ),
  delivered as (
    select total, local_ts from active
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

create or replace function public.admin_review_stats(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  result json;
begin
  if not (public.is_admin() or public.is_viewer()) then
    raise exception 'not authorized';
  end if;

  select json_build_object(
    'total_reviews', (
      select count(*) from order_reviews
      where status = 'approved'
        and (p_from is null or created_at >= p_from)
        and (p_to is null or created_at <= p_to)
    ),
    'rating_sum',    (
      select coalesce(sum(rating), 0) from order_reviews
      where status = 'approved'
        and (p_from is null or created_at >= p_from)
        and (p_to is null or created_at <= p_to)
    ),
    'distribution', (
      select json_build_array(
        count(*) filter (where rating = 1),
        count(*) filter (where rating = 2),
        count(*) filter (where rating = 3),
        count(*) filter (where rating = 4),
        count(*) filter (where rating = 5)
      )
      from order_reviews
      where status = 'approved'
        and (p_from is null or created_at >= p_from)
        and (p_to is null or created_at <= p_to)
    ),
    'per_product', (
      select coalesce(json_agg(json_build_object(
        'product_id', product_id,
        'sum', rating_sum,
        'count', review_count
      )), '[]'::json)
      from (
        select product_id, sum(rating) as rating_sum, count(*) as review_count
        from order_reviews
        where status = 'approved'
          and (p_from is null or created_at >= p_from)
          and (p_to is null or created_at <= p_to)
        group by product_id
      ) t
    )
  ) into result;

  return result;
end;
$$;
