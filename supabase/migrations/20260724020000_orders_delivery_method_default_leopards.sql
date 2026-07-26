-- Every order was delivered via Leopards before this column existed (and
-- still is, unless a staff member marks it otherwise) — so absence of a
-- value means Leopards, not "unknown". Backfill existing rows and default
-- future inserts (storefront place-order, admin manual order creation)
-- so neither has to be updated to set this explicitly.
update public.orders set delivery_method = 'Leopards' where delivery_method is null;
alter table public.orders alter column delivery_method set default 'Leopards';
