-- Enables actually responding to Leopards' shipperAdviceList items (RA/RT
-- via updateShipperAdvice), not just reading the count. Two changes:
--
-- 1. advice_id: Leopards' own internal id for the advice row, required as
--    the primary key updateShipperAdvice expects (cn_number alone isn't
--    accepted per their "eCom Merchant APIs V2" doc, p.89-91). The response
--    shape actually returned in production (confirmed in
--    app/api/courier/shipper-advice/route.ts's comment) includes this
--    field even though the first of the two documented response shapes for
--    this endpoint omits it.
--
-- 2. Delete policy: courier_shipper_advice had insert/update/select
--    policies but no delete policy. The sync route does a full
--    delete-then-insert replace (resolved advice items should disappear
--    from the cache, not linger forever) — without this policy, that
--    delete silently matched 0 rows under RLS, so the "full replace" never
--    actually replaced anything. Found while wiring up the respond action;
--    unrelated to it but directly blocks trusting this table's contents.
alter table public.courier_shipper_advice add column if not exists advice_id bigint;

drop policy if exists "Staff can delete shipper advice" on public.courier_shipper_advice;
create policy "Staff can delete shipper advice"
  on public.courier_shipper_advice for delete
  to authenticated
  using (public.is_admin());
