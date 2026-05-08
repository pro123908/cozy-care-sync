-- Enable per-product reviews inside a single order.
-- Existing order-level reviews are kept with a sentinel product_id value.

alter table if exists public.order_reviews
  add column if not exists product_id text not null default '__order__';

alter table if exists public.order_reviews
  drop constraint if exists order_reviews_order_code_user_id_key;

create unique index if not exists order_reviews_order_user_product_key
  on public.order_reviews (order_code, user_id, product_id);
