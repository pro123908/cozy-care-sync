-- Some orders aren't shipped via Leopards at all — a rider is sent directly
-- via a ride-hailing/local delivery app (InDrive, Bykea, etc.) instead.
-- Plain nullable text, not a check-constrained enum, mirroring orders.source:
-- the option list is enforced client-side in the admin's order detail view
-- and is expected to grow. No RLS/RPC change needed — it's set via a plain
-- `update` on `orders`, already permitted for any admin/staff by the
-- existing orders UPDATE policy (this column isn't part of the `status`
-- WITH CHECK that restricts Cancelled/Returned transitions to the super admin).
alter table public.orders add column delivery_method text;
