-- Review moderation: no approve/reject/delete surface existed before this —
-- reviews went live the moment they were submitted. This adds a post-hoc
-- moderation model: reviews still publish immediately, but admins/staff can
-- hide a bad one (excluding it from admin_review_stats()) or a full admin
-- can permanently delete it.

ALTER TABLE public.order_reviews
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';

ALTER TABLE public.order_reviews
  DROP CONSTRAINT IF EXISTS order_reviews_status_check;

ALTER TABLE public.order_reviews
  ADD CONSTRAINT order_reviews_status_check CHECK (status IN ('approved', 'hidden'));

ALTER TABLE public.order_reviews
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz;

ALTER TABLE public.order_reviews
  ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES auth.users(id);

-- Admins/staff can hide or restore a review — matches the access level
-- already granted for managing products/orders day to day.
DROP POLICY IF EXISTS "Admins can moderate reviews" ON public.order_reviews;
CREATE POLICY "Admins can moderate reviews"
  ON public.order_reviews FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only full admins can permanently delete a review — mirrors the other
-- sensitive, admin-only write surfaces (product costs, categories, banners).
DROP POLICY IF EXISTS "Admins can delete reviews" ON public.order_reviews;
CREATE POLICY "Admins can delete reviews"
  ON public.order_reviews FOR DELETE
  TO authenticated
  USING (public.is_full_admin());

-- Hidden reviews no longer count toward the average/distribution/leaderboards.
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
    'total_reviews', (select count(*) from order_reviews where status = 'approved'),
    'rating_sum',    (select coalesce(sum(rating), 0) from order_reviews where status = 'approved'),
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
      where status = 'approved'
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
        where status = 'approved'
        group by product_id
      ) t
    )
  ) into result;

  return result;
end;
$$;

comment on function public.admin_review_stats() is
  'Review aggregates for the admin Dashboard + Sales pages, excluding reviews hidden via moderation.';
