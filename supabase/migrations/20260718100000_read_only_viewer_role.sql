-- Adds a fourth profile role, 'viewer': a read-only mirror of 'staff' across
-- every table/RPC staff can currently reach, with zero write access anywhere.
--
-- Deliberately does NOT add 'viewer' to is_admin()'s role list — that
-- function gates every INSERT/UPDATE/DELETE policy in the schema (products,
-- orders, categories, homepage_banners, product_costs, known_visitors,
-- push_subscriptions, courier_bookings, courier_shipper_advice, order_reviews,
-- storage.objects), so doing that would grant viewer full staff write access
-- instead of none. Instead:
--   - New public.is_viewer() checks role = 'viewer' alone.
--   - Every is_admin()-gated SELECT policy/RPC a staff member currently
--     reaches is widened to `is_admin() OR is_viewer()`.
--   - Every write policy/RPC is left completely untouched — viewer simply has
--     no matching policy for those operations, so RLS default-denies.
--   - is_full_admin()-only surfaces (audit_logs, ai_insights, categories/
--     banners/product_costs WRITES, order_reviews delete,
--     admin_get_db_usage_stats, meta_events) are intentionally NOT extended —
--     viewer mirrors staff visibility, not full-admin visibility.
--   - product_sales_stats() and product_price_history() need no change: both
--     are plain (non-SECURITY DEFINER) functions that read `orders` directly,
--     so they inherit whatever RLS grants the caller on that table.

create or replace function public.is_viewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'viewer'
  );
$$;

revoke execute on function public.is_viewer() from public;
grant execute on function public.is_viewer() to authenticated;

comment on function public.is_viewer() is
  'True if the current user has role=viewer — read-only mirror of staff access, no write policies granted anywhere.';

-- Allow 'viewer' as a settable role via the existing sanctioned RPC.
create or replace function public.set_profile_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can set profile roles';
  end if;

  if new_role not in ('customer', 'staff', 'admin', 'viewer') then
    raise exception 'Invalid role: %', new_role;
  end if;

  update public.profiles
  set role = new_role,
      updated_at = now()
  where id = target_user_id;

  if not found then
    raise exception 'Profile not found for id %', target_user_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Widen read-only (SELECT) policies to include viewer, table by table.
-- Write policies (INSERT/UPDATE/DELETE) are untouched throughout.
-- ---------------------------------------------------------------------

drop policy if exists "Admins can read all products" on public.products;
create policy "Admins can read all products"
on public.products
for select
to authenticated
using (public.is_admin() or public.is_viewer());

drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders"
on public.orders
for select
to authenticated
using (public.is_admin() or public.is_viewer());

drop policy if exists "Admins can read all categories" on public.categories;
create policy "Admins can read all categories"
on public.categories
for select
to authenticated
using (public.is_admin() or public.is_viewer());

drop policy if exists "Admins can read all homepage banners" on public.homepage_banners;
create policy "Admins can read all homepage banners"
on public.homepage_banners
for select
to authenticated
using (public.is_admin() or public.is_viewer());

drop policy if exists "Admins can read product costs" on public.product_costs;
create policy "Admins can read product costs"
on public.product_costs for select to authenticated
using (public.is_admin() or public.is_viewer());

drop policy if exists "Admins can read own push subscription" on public.push_subscriptions;
create policy "Admins can read own push subscription"
on public.push_subscriptions for select
to authenticated
using (auth.uid() = user_id and (public.is_admin() or public.is_viewer()));

drop policy if exists "Admins can read known visitors" on public.known_visitors;
create policy "Admins can read known visitors"
on public.known_visitors for select to authenticated
using (public.is_admin() or public.is_viewer());

drop policy if exists "Staff can read courier bookings" on public.courier_bookings;
create policy "Staff can read courier bookings"
on public.courier_bookings for select
to authenticated
using (public.is_admin() or public.is_viewer());

drop policy if exists "Staff can read shipper advice" on public.courier_shipper_advice;
create policy "Staff can read shipper advice"
on public.courier_shipper_advice for select
to authenticated
using (public.is_admin() or public.is_viewer());

drop policy if exists "Admins can view all reviews" on public.order_reviews;
create policy "Admins can view all reviews"
on public.order_reviews for select
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  )
  or public.is_viewer()
);

-- ---------------------------------------------------------------------
-- Widen read-only RPCs (stats/aggregates) the same way. Bodies copied
-- verbatim from their latest versions — only the authorization guard
-- changes from `is_admin()` to `is_admin() OR is_viewer()`.
-- ---------------------------------------------------------------------

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
  if not (public.is_admin() or public.is_viewer()) then
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

create or replace function public.admin_review_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not (public.is_admin() or public.is_viewer()) then
    raise exception 'not authorized';
  end if;

  select json_build_object(
    'total_reviews', (select count(*) from order_reviews where status = 'approved'),
    'rating_sum',    (select coalesce(sum(rating), 0) from order_reviews where status = 'approved'),
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
        group by product_id
      ) t
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_review_stats() from public, anon;
grant execute on function public.admin_review_stats() to authenticated;
