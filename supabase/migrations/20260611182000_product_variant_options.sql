alter table public.products
add column if not exists variant_options jsonb not null default '[]'::jsonb;

comment on column public.products.variant_options is
  'Optional named variant pricing array. Example: [{"name":"Standard","price":1200},{"name":"Premium","price":1500}]';
