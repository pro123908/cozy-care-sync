-- Add sales_count to products for tracking hot-selling items
alter table public.products
  add column if not exists sales_count integer not null default 0;

-- Index for fast sorting by popularity
create index if not exists products_sales_count_idx on public.products (sales_count desc);
