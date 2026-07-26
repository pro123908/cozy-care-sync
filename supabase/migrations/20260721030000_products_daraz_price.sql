-- Manual per-product Daraz price override (nullable — null means "no
-- override, sync the store price" per usual). Lets the admin charge a
-- different price on Daraz than in-store (e.g. to absorb Daraz's
-- commission) without the sync tool treating that gap as drift and pushing
-- the store price back down. Set/cleared from admin-app's /daraz page.
alter table public.products
  add column if not exists daraz_price numeric;
