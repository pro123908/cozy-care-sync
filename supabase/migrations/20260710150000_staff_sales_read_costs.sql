-- Staff are now allowed to view Sales Analytics, which shows profit/margin
-- derived from product_costs. So relax the product_costs *read* back to
-- is_admin() (admin + staff). Writes stay admin-only via is_full_admin() so
-- staff can view cost/margin but not change wholesale cost.

drop policy if exists "Admins can read product costs" on public.product_costs;
create policy "Admins can read product costs"
  on public.product_costs for select to authenticated using (public.is_admin());
