alter table public.products
add column if not exists size_options jsonb not null default '[]'::jsonb;

comment on column public.products.size_options is
  'Optional size-based pricing array. Example: [{"size":"S","price":1200},{"size":"M","price":1500}]';
