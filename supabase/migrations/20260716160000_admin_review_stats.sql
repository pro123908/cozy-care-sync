-- Server-side replacement for the full `order_reviews` scans on the admin
-- Dashboard and Sales pages.
--
-- Dashboard paged in EVERY review row just to compute one average and a count.
-- Sales paged in every (product_id, rating) pair to build a 5-star distribution
-- and per-product rollups. Both now come from this single query.
--
-- Mirrors the existing client-side math exactly:
--   * order_reviews.rating is `integer check (rating between 1 and 5)`, so the
--     client's Math.round()/clamp on each rating are no-ops — a plain
--     `filter (where rating = n)` reproduces the distribution buckets exactly,
--     with no float-rounding semantics to worry about.
--   * Returns rating_sum + counts rather than pre-divided averages, so the
--     client keeps doing sum/count itself. Identical floating-point result, no
--     drift between the two implementations.
--   * per_product covers ALL reviews. Sales then filters these against the
--     products it already has in memory (reviews for since-deleted products get
--     dropped client-side, as today) — so no join to products is needed here,
--     and no extra rows go over the wire.
create or replace function public.admin_review_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select json_build_object(
    'total_reviews', (select count(*) from order_reviews),
    'rating_sum',    (select coalesce(sum(rating), 0) from order_reviews),
    -- [count of 1★, 2★, 3★, 4★, 5★] — matches the client's distribution array
    -- (index 0 = 1-star … index 4 = 5-star).
    'distribution', (
      select json_build_array(
        count(*) filter (where rating = 1),
        count(*) filter (where rating = 2),
        count(*) filter (where rating = 3),
        count(*) filter (where rating = 4),
        count(*) filter (where rating = 5)
      )
      from order_reviews
    ),
    'per_product', (
      select coalesce(json_agg(json_build_object(
        'product_id', product_id,
        'sum', rating_sum,
        'count', review_count
      )), '[]'::json)
      from (
        select product_id, sum(rating) as rating_sum, count(*) as review_count
        from order_reviews
        group by product_id
      ) t
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_review_stats() from public, anon;
grant execute on function public.admin_review_stats() to authenticated;

comment on function public.admin_review_stats() is
  'Review aggregates for the admin Dashboard + Sales pages, replacing full-table order_reviews scans.';
