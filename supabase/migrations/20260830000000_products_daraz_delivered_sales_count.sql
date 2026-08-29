-- Tracks units sold via Daraz (item-level status "delivered" only, same
-- delivered-not-just-placed convention as products.delivered_sales_count
-- for storefront orders — see 20260723060000_products_delivered_sales_count.sql)
-- so the storefront's "N+ sold" stat can reflect both sales channels, not
-- just its own orders. Kept as its own column rather than folded into
-- delivered_sales_count since the two are synced by entirely different
-- mechanisms (a Postgres trigger off local orders vs. a scheduled job
-- polling Daraz's API) and each needs to stay independently inspectable.
alter table public.products
  add column if not exists daraz_delivered_sales_count integer not null default 0;
