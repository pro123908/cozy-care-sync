-- New, separate counter for "actually completed sales" — distinct from
-- products.sales_count, which is deliberately an all-orders demand counter
-- (incremented at order placement via increment_product_sales, called from
-- place-order/index.ts; never decremented for cancellations — see
-- 20260618122000_recalculate_product_sales_counts_fn.sql). Surfaced while
-- wiring up a "hot selling" badge/ranking boost for search: a product with
-- e.g. 36 orders placed but only 17 actually Delivered (the rest cancelled
-- or still in transit) shouldn't be called "hot" off the inflated number —
-- that already has a precedent elsewhere in this schema
-- (product_sales_stats(), used for revenue/analysis, is Delivered-only for
-- the same reason: money isn't collected/confirmed until delivery).
--
-- Kept separate from sales_count rather than redefining that column,
-- because sales_count is also used elsewhere as a raw demand/popularity
-- signal (e.g. the "popular" sort in src/wcm/products.tsx) where "orders
-- placed regardless of outcome" may still be the right meaning — only the
-- Hot badge/search-ranking use case needed the delivered-only definition.
alter table public.products
  add column if not exists delivered_sales_count integer not null default 0;

create index if not exists products_delivered_sales_count_idx
  on public.products (delivered_sales_count desc);

-- One-time backfill from current order history, same shape as
-- product_sales_stats()'s Delivered-only aggregation.
update public.products p
set delivered_sales_count = coalesce(dc.qty, 0)
from (
  select
    item->>'id' as product_id,
    sum(greatest(coalesce((item->>'qty')::int, 1), 1)) as qty
  from public.orders o
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end
  ) item
  where lower(o.status) = 'delivered'
    and coalesce(item->>'id', '') <> ''
  group by 1
) dc
where p.id = dc.product_id;

-- Keeps delivered_sales_count live going forward. Fires only on a genuine
-- transition into or out of Delivered (not on every unrelated order edit),
-- adjusting every line item's product by its qty. Symmetric (+/-) so an
-- admin correcting a status back out of Delivered doesn't leave the counter
-- permanently inflated.
create or replace function public.sync_delivered_sales_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  was_delivered boolean;
  is_delivered boolean;
  delta int;
begin
  was_delivered := (TG_OP = 'UPDATE') and lower(coalesce(OLD.status, '')) = 'delivered';
  is_delivered := lower(coalesce(NEW.status, '')) = 'delivered';

  if was_delivered = is_delivered then
    return NEW;
  end if;

  delta := case when is_delivered then 1 else -1 end;

  for item in
    select elem
    from jsonb_array_elements(
      case when jsonb_typeof(NEW.items) = 'array' then NEW.items else '[]'::jsonb end
    ) as elem
  loop
    if coalesce(item.elem->>'id', '') <> '' then
      update public.products
      set delivered_sales_count = greatest(
        0,
        delivered_sales_count + delta * greatest(coalesce((item.elem->>'qty')::int, 1), 1)
      )
      where id = item.elem->>'id';
    end if;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists products_delivered_sales_count_trigger on public.orders;
create trigger products_delivered_sales_count_trigger
  after insert or update of status on public.orders
  for each row execute function public.sync_delivered_sales_count();
