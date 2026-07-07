-- Rank exact word matches ahead of prefix-only matches in search_products.
-- After restricting matches to name/brand, "car" still ranked "Life Care ..."
-- products above "Car Home Massager": prefix matching treats a hit on
-- "car" (exact word) and "care" (word starting with "car") as equally
-- strong, and "Life Care" brands got a term-frequency boost from repeating
-- "Care" in both name and brand. Add a primary sort key that scores an
-- exact-word tsquery match, so literal "car" always outranks "care".

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
    select
      case
        when cleaned is null then null
        else to_tsquery('english', regexp_replace(cleaned, '\s+', ':* & ', 'g') || ':*')
      end as tsq_prefix,
      case
        when cleaned is null then null
        else to_tsquery('english', regexp_replace(cleaned, '\s+', ' & ', 'g'))
      end as tsq_exact
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
    and (
      parsed_query.tsq_prefix is null
      or ts_filter(p.search_vector, '{A,B}'::"char"[]) @@ parsed_query.tsq_prefix
    )
    and (cat_filter = 'all' or p.cat = cat_filter)
  order by
    -- primary: exact whole-word matches ("car") outrank prefix-only ("care")
    case when sort_by = 'relevance' and parsed_query.tsq_exact is not null
      then ts_rank_cd(ts_filter(p.search_vector, '{A,B}'::"char"[]), parsed_query.tsq_exact, 32)
      else 0
    end desc,
    -- secondary: relevance among remaining prefix matches
    case when sort_by = 'relevance' and parsed_query.tsq_prefix is not null
      then ts_rank_cd(ts_filter(p.search_vector, '{A,B}'::"char"[]), parsed_query.tsq_prefix, 32)
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
