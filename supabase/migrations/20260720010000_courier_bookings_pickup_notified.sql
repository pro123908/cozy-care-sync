-- Marks when a customer was sent the "picked up by courier" WhatsApp
-- notification for a booking, so the admin-app sync route (which detects
-- the transition to "Dispatched" on each run) never sends it twice for the
-- same booking. Same pattern as orders.customer_confirmed_at.
alter table public.courier_bookings
  add column if not exists pickup_notified_at timestamptz;
