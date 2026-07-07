-- Fix: search_products matched query text anywhere inside a product's name,
-- so searching "car" also returned "Lifecare" and "Medicare" (the letters
-- "car" happen to appear mid-word). Replace the raw
-- `name ilike '%' || q || '%'` fallback with a tsquery prefix match, which
-- only matches whole tokens ("Lifecare" tokenizes as one word and never
-- starts with "car"), while still supporting incremental/prefix typing
-- ("car" still matches "Car Home Massager" and "Life Care Steamer").

create or replace function public.search_products(
  q            text,
  cat_filter   text    default 'all',
  sort_by      text    default 'relevance',
  p_offset     integer default 0,
  p_limit      integer default 24
)
returns table(
  id             text,
  name           text,
  brand          text,
  cat            text,
  category_name  text,
  price          numeric,
  was            numeric,
  rating         numeric,
  reviews        integer,
  sales_count    integer,
  stock          text,
  tags           text[],
  blurb          text,
  swatch         text,
  image_url      text,
  size_options   jsonb,
  variant_options jsonb,
  total_count    bigint
)
language sql
security definer
stable
as $$
  with parsed as (
    select nullif(
      trim(regexp_replace(coalesce(q, ''), '[^a-zA-Z0-9\s]', ' ', 'g')),
      ''
    ) as cleaned
  ),
  parsed_query as (
    select case
      when cleaned is null then null
      else to_tsquery('english', regexp_replace(cleaned, '\s+', ':* & ', 'g') || ':*')
    end as tsq
    from parsed
  )
  select
    p.id,
    p.name,
    p.brand,
    p.cat,
    c.name                      as category_name,
    p.price,
    p.was,
    p.rating,
    p.reviews,
    p.sales_count::integer,
    p.stock,
    p.tags::text[],
    p.blurb,
    p.swatch,
    p.image_url,
    to_jsonb(p.size_options)    as size_options,
    to_jsonb(p.variant_options) as variant_options,
    count(*) over ()            as total_count
  from public.products p
  left join public.categories c on c.slug = p.cat
  cross join parsed_query
  where
    p.active = true
    and (parsed_query.tsq is null or p.search_vector @@ parsed_query.tsq)
    and (cat_filter = 'all' or p.cat = cat_filter)
  order by
    -- relevance: rank by ts_rank (nulls last for other sort modes)
    case when sort_by = 'relevance' and parsed_query.tsq is not null
      then ts_rank_cd(p.search_vector, parsed_query.tsq, 32)
    end desc nulls last,
    -- price ascending
    case when sort_by = 'price_asc'  then p.price end asc  nulls last,
    -- price descending (negate so we can use asc)
    case when sort_by = 'price_desc' then p.price end desc nulls last,
    -- secondary: always surface higher-sold products within same rank
    p.sales_count desc nulls last,
    p.sort_order  asc  nulls last
  limit  p_limit
  offset p_offset
$$;

grant execute on function public.search_products to anon, authenticated;
