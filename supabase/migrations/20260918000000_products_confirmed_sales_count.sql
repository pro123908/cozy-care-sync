-- Second, separate "sold" counter for the storefront PDP badge (🔥 N+ sold),
-- alongside the existing delivered_sales_count (used for search "hot" ranking
-- and revenue stats — intentionally left delivered-only, see
-- 20260723060000_products_delivered_sales_count.sql). This one counts an
-- order as "sold" once it reaches Order confirmed or later — the same
-- "Confirmed or later, not Cancelled/Returned" status set already used for
-- stock deduction (public.order_status_holds_stock(), see
-- 20260718000000_stock_deducted_on_confirm.sql) — so the badge reflects real
-- demand sooner than waiting for delivery, without duplicating that status
-- list.
alter table public.products
  add column if not exists confirmed_sales_count integer not null default 0;

create index if not exists products_confirmed_sales_count_idx
  on public.products (confirmed_sales_count desc);

-- One-time backfill from current order status.
update public.products p
set confirmed_sales_count = coalesce(cc.qty, 0)
from (
  select
    item->>'id' as product_id,
    sum(greatest(coalesce((item->>'qty')::int, 1), 1)) as qty
  from public.orders o
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end
  ) item
  where public.order_status_holds_stock(o.status)
    and coalesce(item->>'id', '') <> ''
  group by 1
) cc
where p.id = cc.product_id;

-- Keeps confirmed_sales_count live going forward. Fires only on a genuine
-- transition into or out of the "holds stock" status set, adjusting every
-- line item's product by its qty. Symmetric (+/-) so a cancellation or
-- return backs the counter back out.
create or replace function public.sync_confirmed_sales_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  was_counted boolean;
  is_counted boolean;
  delta int;
begin
  was_counted := (TG_OP = 'UPDATE') and public.order_status_holds_stock(coalesce(OLD.status, ''));
  is_counted := public.order_status_holds_stock(coalesce(NEW.status, ''));

  if was_counted = is_counted then
    return NEW;
  end if;

  delta := case when is_counted then 1 else -1 end;

  for item in
    select elem
    from jsonb_array_elements(
      case when jsonb_typeof(NEW.items) = 'array' then NEW.items else '[]'::jsonb end
    ) as elem
  loop
    if coalesce(item.elem->>'id', '') <> '' then
      update public.products
      set confirmed_sales_count = greatest(
        0,
        confirmed_sales_count + delta * greatest(coalesce((item.elem->>'qty')::int, 1), 1)
      )
      where id = item.elem->>'id';
    end if;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists products_confirmed_sales_count_trigger on public.orders;
create trigger products_confirmed_sales_count_trigger
  after insert or update of status on public.orders
  for each row execute function public.sync_confirmed_sales_count();
