-- Tracks how a manually-created order (the admin "Add order" dialog, for
-- phone/WhatsApp orders placed outside storefront checkout) came in — e.g.
-- "WhatsApp" vs "Friends & Family" (gifted/informal orders). Plain nullable
-- text, not a check-constrained enum: the option list is enforced client-side
-- in the Add/Edit order form and is expected to grow, and storefront-placed
-- orders simply leave this null (they have their own, unrelated origin).
alter table public.orders add column source text;

-- Same drop+create pattern as 20260719200000_admin_update_order_nullable_params.sql
-- doesn't apply here — appending a new trailing defaulted param is allowed via
-- create or replace (only *reordering* existing params requires drop+create).
create or replace function public.admin_update_order(
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
  p_landmark text default null,
  p_source text default null
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
    total = p_total,
    source = p_source
  where id = p_order_id
  returning * into updated;

  return updated;
end;
$$;
