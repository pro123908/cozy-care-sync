-- Split the admin panel into two real tiers.
--
-- Until now `public.is_admin()` returned true for BOTH 'admin' and 'staff', and
-- every admin policy used it — so staff had full access. We introduce
-- `public.is_full_admin()` (role = 'admin' only) and move the sensitive
-- surfaces onto it, so a 'staff' user can manage products and orders but cannot
-- see purchase cost/margin, manage categories/banners, or read the internal
-- meta-events / audit logs.
--
-- Unchanged (staff keeps full access): products (all), orders (all).
-- The customer storefront is unaffected — it writes via the service-role key,
-- which bypasses RLS entirely.

create or replace function public.is_full_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

revoke execute on function public.is_full_admin() from public;
grant execute on function public.is_full_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- product_costs — purchase price / margin. Admin only (read AND write).
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can read product costs" on public.product_costs;
create policy "Admins can read product costs"
  on public.product_costs for select to authenticated using (public.is_full_admin());

drop policy if exists "Admins can insert product costs" on public.product_costs;
create policy "Admins can insert product costs"
  on public.product_costs for insert to authenticated with check (public.is_full_admin());

drop policy if exists "Admins can update product costs" on public.product_costs;
create policy "Admins can update product costs"
  on public.product_costs for update to authenticated using (public.is_full_admin()) with check (public.is_full_admin());

drop policy if exists "Admins can delete product costs" on public.product_costs;
create policy "Admins can delete product costs"
  on public.product_costs for delete to authenticated using (public.is_full_admin());

-- ---------------------------------------------------------------------------
-- categories — write policies admin only (public SELECT stays as-is).
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can insert categories" on public.categories;
create policy "Admins can insert categories"
  on public.categories for insert to authenticated with check (public.is_full_admin());

drop policy if exists "Admins can update categories" on public.categories;
create policy "Admins can update categories"
  on public.categories for update to authenticated using (public.is_full_admin()) with check (public.is_full_admin());

drop policy if exists "Admins can delete categories" on public.categories;
create policy "Admins can delete categories"
  on public.categories for delete to authenticated using (public.is_full_admin());

-- ---------------------------------------------------------------------------
-- homepage_banners — write policies admin only (public SELECT stays as-is).
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can insert homepage banners" on public.homepage_banners;
create policy "Admins can insert homepage banners"
  on public.homepage_banners for insert to authenticated with check (public.is_full_admin());

drop policy if exists "Admins can update homepage banners" on public.homepage_banners;
create policy "Admins can update homepage banners"
  on public.homepage_banners for update to authenticated using (public.is_full_admin()) with check (public.is_full_admin());

drop policy if exists "Admins can delete homepage banners" on public.homepage_banners;
create policy "Admins can delete homepage banners"
  on public.homepage_banners for delete to authenticated using (public.is_full_admin());

-- ---------------------------------------------------------------------------
-- audit_logs — activity history. Admin only.
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can read audit logs" on public.audit_logs;
create policy "Admins can read audit logs"
  on public.audit_logs for select to authenticated using (public.is_full_admin());

-- ---------------------------------------------------------------------------
-- meta_events — pixel/CAPI delivery log. Admin only (was admin + staff).
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can view all meta events" on public.meta_events;
create policy "Admins can view all meta events"
  on public.meta_events for select to authenticated using (public.is_full_admin());
