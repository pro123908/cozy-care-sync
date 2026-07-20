-- Leopards' bookPacket response includes a one-time slip_link (the
-- printable booking slip URL) that isn't retrievable again afterwards via
-- their API. Persisting it so admins can print/reprint from the /courier
-- page later instead of losing it if they close the creation modal without
-- printing. Only bookings created through this admin panel's "Book Courier"
-- feature will have one — bookings synced from Leopards' own
-- getBookedPacketLastStatus never include it, so this column stays null for
-- those (and that sync path doesn't touch this column either way).

alter table public.courier_bookings add column if not exists slip_link text;
