-- Storefront checkout's city autocomplete was a hardcoded, incomplete
-- ~120-city static list (src/wcm/data.ts in the storefront repo), disconnected
-- from Leopards' real ~827-city serviceable list already mirrored into
-- courier_cities for the admin "Book Courier" picker. courier_cities' only
-- existing policy is staff/admin-only (is_admin()), so the public storefront
-- couldn't read it. Nothing in this table is sensitive (city name, Leopards
-- id, origin/destination flags, shipment type), so open read access to the
-- destination-servable subset — that's the only slice checkout needs.
drop policy if exists "Public can view destination courier cities" on public.courier_cities;
create policy "Public can view destination courier cities"
  on public.courier_cities for select
  to anon, authenticated
  using (allow_as_destination = true);
