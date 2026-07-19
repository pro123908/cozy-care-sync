-- No behavior change: p_email/p_city/p_landmark already accepted NULL at
-- the SQL level (plain `text`, no NOT NULL constraint) — this just adds
-- `default null` so Supabase's generated TS types stop marking them as
-- required, matching what the function actually does. Surfaced 2026-07-19
-- when regenerating types.ts exposed a real (but harmless) type mismatch
-- in app/orders/page.tsx's updateOrderDetails call.
--
-- Postgres requires all parameters after the first defaulted one to also
-- have defaults, so the three nullable params move to the end. This is a
-- drop+create (not `create or replace`) because reordering existing
-- parameters isn't allowed via replace. Safe here: always called via
-- PostgREST/.rpc() with named arguments, never positionally.
drop function if exists public.admin_update_order(uuid, text, text, text, text, text, text, text, jsonb, integer, integer, integer);

create function public.admin_update_order(
  p_order_id uuid,
  p_customer_name text,
  p_phone text,
  p_address text,
  p_payment text,
  p_items jsonb,
  p_subtotal integer,
  p_shipping integer,
  p_total integer,
  p_email text default null,
  p_city text default null,
  p_landmark text default null
)
returns public.orders
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  cur_items jsonb;
  cur_status text;
  updated public.orders;
begin
  if not public.is_super_admin() then
    raise exception 'Only the super admin can edit orders';
  end if;

  select items, status into cur_items, cur_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if public.order_status_holds_stock(cur_status) then
    perform public.adjust_stock_for_order_items(cur_items, 1);
    perform public.adjust_stock_for_order_items(p_items, -1);
  end if;

  update public.orders
  set
    customer_name = p_customer_name,
    phone = p_phone,
    email = p_email,
    address = p_address,
    city = p_city,
    landmark = p_landmark,
    payment = p_payment,
    items = p_items,
    subtotal = p_subtotal,
    shipping = p_shipping,
    total = p_total
  where id = p_order_id
  returning * into updated;

  return updated;
end;
$$;
