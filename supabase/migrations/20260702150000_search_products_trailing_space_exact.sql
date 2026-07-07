-- Treat a trailing space in the search box as "this word is finished".
-- Previously every word (including the last one) was always matched as a
-- prefix ("car:*"), so "Life Care" kept showing up for "car " because
-- "Care" starts with "car". Now: while the user is still typing the last
-- word (no trailing space), it's matched as a prefix so suggestions still
-- appear as-you-type; once a trailing space is typed, the last word is
-- matched as a complete/exact word, so "car " no longer matches "Care".

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
    select regexp_replace(coalesce(q, ''), '[^a-zA-Z0-9\s]', ' ', 'g') as norm
  ),
  parsed2 as (
    select
      nullif(trim(norm), '') as cleaned,
      (norm ~ '\s$')         as ends_with_space
    from parsed
  ),
  words as (
    select
      p2.ends_with_space,
      regexp_split_to_array(p2.cleaned, '\s+') as arr
    from parsed2 p2
    where p2.cleaned is not null
  ),
  parsed_query as (
    select
      (
        select to_tsquery('english',
          case
            when array_length(w.arr, 1) = 1 then
              case when w.ends_with_space then w.arr[1] else w.arr[1] || ':*' end
            else
              array_to_string(w.arr[1:array_length(w.arr, 1) - 1], ' & ')
              || ' & ' ||
              case when w.ends_with_space then w.arr[array_length(w.arr, 1)]
                   else w.arr[array_length(w.arr, 1)] || ':*' end
          end
        )
        from words w
      ) as tsq_search,
      (
        select to_tsquery('english', array_to_string(w.arr, ' & '))
        from words w
      ) as tsq_exact
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
      parsed_query.tsq_search is null
      or ts_filter(p.search_vector, '{A,B}'::"char"[]) @@ parsed_query.tsq_search
    )
    and (cat_filter = 'all' or p.cat = cat_filter)
  order by
    -- primary: exact whole-word matches ("car") outrank prefix-only ("care")
    case when sort_by = 'relevance' and parsed_query.tsq_exact is not null
      then ts_rank_cd(ts_filter(p.search_vector, '{A,B}'::"char"[]), parsed_query.tsq_exact, 32)
      else 0
    end desc,
    -- secondary: relevance among remaining matches (covers the in-progress prefix case)
    case when sort_by = 'relevance' and parsed_query.tsq_search is not null
      then ts_rank_cd(ts_filter(p.search_vector, '{A,B}'::"char"[]), parsed_query.tsq_search, 32)
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
