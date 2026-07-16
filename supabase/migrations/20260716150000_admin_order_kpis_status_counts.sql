-- Adds status_counts to admin_order_kpis().
--
-- Rationale: the dashboard's status donut was the last thing (besides the
-- delivery-time calc) still forcing a full `orders` fetch — it only ever needed
-- a count per status. With this, the dashboard no longer pages the whole orders
-- table on every 60s poll; the only remaining row-level read is the handful of
-- DELIVERED orders needed to diff against the audit trail.
--
-- Everything else is unchanged from 20260716141000 — the client-side math this
-- mirrors is documented in 20260716140000.
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
    'top_area',          (select city from top_city),
    'top_payment_method',(select payment from top_pay),
    'top_payment_count', (select n from top_pay),
    'total_customers',   (select count(*) from cust),
    'repeat_customers',  (select count(*) from cust where n > 1),
    -- { "Delivered": 8, "Processing": 12, ... } — mirrors the client's
    -- orderStatuses.forEach() tally that fed the donut.
    'status_counts',     (select coalesce(json_object_agg(status, n), '{}'::json) from statuses)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_order_kpis() from public, anon;
grant execute on function public.admin_order_kpis() to authenticated;
