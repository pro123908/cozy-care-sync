-- Fix-forward on 20260716140000: admin_order_kpis() was security definer and
-- granted to `authenticated`, with no admin check inside. The storefront has
-- authenticated CUSTOMERS, so any logged-in shopper could have called it and
-- read store-wide order counts, revenue and customer stats. Add the same
-- is_admin() gate the rest of the admin surface uses.
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
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_order_kpis() from public, anon;
grant execute on function public.admin_order_kpis() to authenticated;
