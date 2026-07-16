-- Server-side replacement for the Sales page's full-`orders` scan (which ran
-- every 5s just to bucket revenue by month/week and tally customer frequency).
--
-- ⚠️ Timezone is load-bearing here. The client bucketed using browser-LOCAL
-- dates (getFullYear/getMonth/getDay), and the store operates in Pakistan, so
-- all bucketing here is done `at time zone 'Asia/Karachi'` to land orders in
-- the same month/week the client did. Getting this wrong shifts chart bars
-- across boundaries — the parallel-diff on the page guards against it.
--
-- Mirrors the client math exactly:
--   * "active" = status NOT IN ('cancelled','Cancelled') — both casings the JS
--     checked, nothing else (a hypothetical 'CANCELLED' would be included, as
--     it was client-side).
--   * Week starts SUNDAY (JS getDay()=0), not Postgres' ISO Monday — computed
--     as local_date - dow days.
--   * Customer key = lower(trim(phone || email fallback)); a whitespace-only
--     phone is truthy in JS so it wins then trims to '' and is skipped (does
--     NOT fall back to email) — reproduced with the explicit coalesce test.
--   * Returns raw revenue/counts (not rounded) so the client keeps doing its
--     own Math.round for the "revenueK" display — no rounding drift.
--   * first_order_at is returned so the client keeps computing daysActive
--     against its own Date.now() (velocity), unchanged.
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
  by_month as (
    select to_char(local_ts, 'YYYY-MM') as key,
           sum(total) as revenue, count(*) as orders
    from active group by 1
  ),
  by_week as (
    -- Sunday-start week key (local), as ISO date string, matching the JS
    -- weekStart.toISOString().slice(0,10).
    select (local_ts::date - extract(dow from local_ts)::int)::text as key,
           sum(total) as revenue, count(*) as orders
    from active group by 1
  ),
  cust as (
    select customer_key, count(*) as n
    from active where customer_key is not null group by customer_key
  )
  select json_build_object(
    'total_order_count', (select count(*) from active),
    'revenue_sum',       (select coalesce(sum(total), 0) from active),
    'first_order_at',    (select min(created_at) from active),
    'revenue_by_month',  (
      select coalesce(json_agg(json_build_object('key', key, 'revenue', revenue, 'orders', orders)
                               order by key), '[]'::json)
      from by_month
    ),
    'revenue_by_week',   (
      select coalesce(json_agg(json_build_object('key', key, 'revenue', revenue, 'orders', orders)
                               order by key), '[]'::json)
      from by_week
    ),
    'total_customers',   (select count(*) from cust),
    'repeat_customers',  (select count(*) from cust where n > 1),
    'freq1',             (select count(*) from cust where n = 1),
    'freq2',             (select count(*) from cust where n = 2),
    'freq3plus',         (select count(*) from cust where n >= 3)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_sales_stats() from public, anon;
grant execute on function public.admin_sales_stats() to authenticated;

comment on function public.admin_sales_stats() is
  'Revenue buckets + customer frequency for the Sales page, replacing a full-orders scan on every 5s poll. Buckets in Asia/Karachi to match the old client-side math.';
