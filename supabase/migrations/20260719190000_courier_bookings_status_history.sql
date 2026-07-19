-- Full status-transition history for a shipment, sourced from Leopards'
-- trackBookedPacket API ("Tracking Detail" array: Status, Status_With_City,
-- Activity_datetime). Populated during the existing rate-limited sync
-- (app/api/courier/bookings/route.ts in admin-app), batched across all
-- tracking numbers in one call — never called live per customer view.
alter table public.courier_bookings
  add column if not exists status_history jsonb;
