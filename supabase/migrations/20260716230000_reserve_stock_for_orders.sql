-- Stock reservation: products.stock_count has always been a purely manual,
-- admin-typed number with zero automatic link to the orders table — placing
-- an order never reserved stock, cancelling one never released it. This adds
-- that link going forward, plus a one-time backfill to correct existing
-- numbers to the same baseline the trigger will now maintain.
--
-- Model: stock_count represents "available to sell" (not raw physical
-- count). It is decremented the moment an order is created (reserving the
-- stock for that order regardless of its status), and restored only if the
-- order is cancelled or deleted outright. No other status transition
-- touches it — the reservation happens once, at placement, and is released
-- once, on cancellation.
--
-- Clamped at zero (not allowed to go negative): products already has a
-- `products_stock_count_nonnegative CHECK (stock_count >= 0)` constraint
-- (20260502152000_products-stock-count.sql). Without clamping, a future
-- order on an already-tight product would make the reservation trigger's
-- UPDATE violate that constraint — which would fail the INSERT into
-- `orders` itself and break checkout. Clamping means real oversell floors
-- at 0 ("Out of stock") instead of surfacing the exact negative deficit.

-- Shared helper: walk an order's `items` jsonb array and adjust stock_count
-- for each product by `sign * qty` (sign = -1 to reserve, +1 to release).
-- Mirrors the same items-parsing pattern as recalculate_product_sales_counts().
create or replace function public.adjust_stock_for_order_items(order_items jsonb, sign integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  for item in
    select value from jsonb_array_elements(
      case when jsonb_typeof(order_items) = 'array' then order_items else '[]'::jsonb end
    )
  loop
    if coalesce(item->>'id', '') = '' then
      continue;
    end if;
    update public.products
    set stock_count = greatest(0, stock_count + sign * greatest(coalesce((item->>'qty')::int, 1), 1))
    where id = item->>'id';
  end loop;
end;
$$;

revoke all on function public.adjust_stock_for_order_items(jsonb, integer) from public, anon, authenticated;

-- Reserve stock the moment an order is created (unless it's created
-- pre-cancelled, which never happens in practice but costs nothing to guard).
create or replace function public.orders_reserve_stock_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status is distinct from 'Cancelled' then
    perform public.adjust_stock_for_order_items(NEW.items, -1);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_orders_reserve_stock_on_insert on public.orders;
create trigger trg_orders_reserve_stock_on_insert
  after insert on public.orders
  for each row
  execute function public.orders_reserve_stock_on_insert();

-- Release the reservation when an order is cancelled; re-reserve if an
-- accidental/incorrect cancellation is reversed.
create or replace function public.orders_adjust_stock_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status is distinct from OLD.status then
    if NEW.status = 'Cancelled' and OLD.status is distinct from 'Cancelled' then
      perform public.adjust_stock_for_order_items(NEW.items, 1);
    elsif OLD.status = 'Cancelled' and NEW.status is distinct from 'Cancelled' then
      perform public.adjust_stock_for_order_items(NEW.items, -1);
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_orders_adjust_stock_on_status_change on public.orders;
create trigger trg_orders_adjust_stock_on_status_change
  after update of status on public.orders
  for each row
  execute function public.orders_adjust_stock_on_status_change();

-- Release stock if a non-cancelled order is deleted outright (super-admin
-- only path — see 20260714120000_orders_cancel_delete_super_admin_only.sql).
create or replace function public.orders_release_stock_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.status is distinct from 'Cancelled' then
    perform public.adjust_stock_for_order_items(OLD.items, 1);
  end if;
  return OLD;
end;
$$;

drop trigger if exists trg_orders_release_stock_on_delete on public.orders;
create trigger trg_orders_release_stock_on_delete
  before delete on public.orders
  for each row
  execute function public.orders_release_stock_on_delete();

-- One-time backfill: subtract quantities already committed to every existing
-- non-cancelled order from current stock_count, so the number matches what
-- the trigger above will maintain automatically from this point forward.
-- Floored at zero to satisfy products_stock_count_nonnegative.
with order_item_qty as (
  select
    item->>'id' as product_id,
    sum(greatest(coalesce((item->>'qty')::int, 1), 1)) as qty
  from public.orders o
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end
  ) item
  where o.status is distinct from 'Cancelled'
    and coalesce(item->>'id', '') <> ''
  group by 1
)
update public.products p
set stock_count = greatest(0, p.stock_count - oiq.qty)
from order_item_qty oiq
where oiq.product_id = p.id;
