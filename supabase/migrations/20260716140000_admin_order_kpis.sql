-- Server-side replacement for the admin Dashboard's full-`orders` fetch.
--
-- The dashboard was paging the ENTIRE orders table every 60s (via fetchAllRows)
-- purely to derive a handful of scalars: pending count, AOV, top city, payment
-- mix and repeat-customer rate. This computes all of it in one query.
--
-- ⚠️ This deliberately mirrors the EXISTING client-side JS math in app/page.tsx
-- exactly, quirks included, so the numbers don't silently change:
--   * avg_order_value averages over ALL orders (cancelled included) — that is
--     what the JS did; not obviously right, but changing it here would be an
--     unannounced behaviour change.
--   * The customer key mirrors JS `(o.phone || o.email || "").trim().toLowerCase()`.
--     Note the subtlety: in JS a whitespace-only phone ("  ") is TRUTHY, so it
--     wins over email and then trims to "" and is skipped — it does NOT fall
--     back to email. A naive coalesce(nullif(trim(phone),'')...) would wrongly
--     fall back. Hence the explicit `coalesce(phone,'') <> ''` test.
--   * Raw ingredients (counts) are returned rather than percentages so the
--     client keeps doing its own Math.round — identical output, no rounding drift.
--
-- Ties: JS took the first max after a stable sort (i.e. arbitrary DB order).
-- Here ties break deterministically by name — a deliberate, harmless improvement.
create or replace function public.admin_order_kpis()
returns json
language sql
stable
security definer
set search_path = public
as $$
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
  )
  select json_build_object(
    'total_orders',      (select count(*) from o),
    'pending_orders',    (select count(*) from o where status not in ('Delivered', 'Cancelled')),
    'revenue_sum',       (select coalesce(sum(total), 0) from o),
    'top_area',          (select city from top_city),
    'top_payment_method',(select payment from top_pay),
    'top_payment_count', (select n from top_pay),
    'total_customers',   (select count(*) from cust),
    'repeat_customers',  (select count(*) from cust where n > 1)
  );
$$;

revoke all on function public.admin_order_kpis() from public, anon;
grant execute on function public.admin_order_kpis() to authenticated;

comment on function public.admin_order_kpis() is
  'Aggregates for the admin dashboard, replacing a full-table orders fetch. Mirrors the previous client-side math exactly (see migration comments).';
