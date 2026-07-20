-- Reviews are collected (rating + comment) but there was no way for a
-- shopper to read anyone else's review — order_reviews only grants SELECT
-- to the review's own author or an admin/staff. Add a public read policy
-- scoped to approved reviews only, so the storefront product page can show
-- real customer reviews. Hidden (moderated-out) reviews stay invisible.
CREATE POLICY "Anyone can read approved reviews"
  ON public.order_reviews FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');
