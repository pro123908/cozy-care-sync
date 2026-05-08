alter table public.categories
add column if not exists top_category boolean not null default false;

create index if not exists categories_top_category_idx
  on public.categories (top_category, sort_order);
