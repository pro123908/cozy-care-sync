-- Full-text search for products
-- Adds a weighted tsvector column, a GIN index, an auto-update trigger,
-- and a search_products RPC callable from the frontend.

-- 1. Add the search_vector column
alter table public.products
  add column if not exists search_vector tsvector;

-- 2. Trigger function: rebuilds search_vector on every insert/update
create or replace function public.products_search_vector_update()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name,  '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.brand, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.blurb, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.cat,   '')), 'D');
  return new;
end;
$$;

-- 3. Attach the trigger
drop trigger if exists products_search_vector_trigger on public.products;
create trigger products_search_vector_trigger
  before insert or update on public.products
  for each row execute function public.products_search_vector_update();

-- 4. Back-fill existing rows
update public.products set
  search_vector =
    setweight(to_tsvector('english', coalesce(name,  '')), 'A') ||
    setweight(to_tsvector('english', coalesce(brand, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(blurb, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(cat,   '')), 'D');

-- 5. GIN index for fast full-text lookups
create index if not exists products_search_vector_idx
  on public.products using gin(search_vector);

-- 6. RPC: search_products
--    Returns ranked products + a total_count window column for pagination.
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
  where
    p.active = true
    and (
      q is null or q = ''
      or p.search_vector @@ plainto_tsquery('english', q)
      or p.name  ilike '%' || q || '%'
      or p.brand ilike '%' || q || '%'
    )
    and (cat_filter = 'all' or p.cat = cat_filter)
  order by
    -- relevance: rank by ts_rank (nulls last for other sort modes)
    case when sort_by = 'relevance' and q is not null and q != ''
      then ts_rank_cd(p.search_vector, plainto_tsquery('english', q), 32)
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
