-- Tracks customer-initiated Confirm/Cancel taps from the WhatsApp order
-- confirmation template's quick-reply buttons. These are informational flags
-- only: Confirm does NOT set status to "Order confirmed" (stock deduction
-- stays admin-gated), and Cancel does NOT set status to "Cancelled" (that
-- remains super-admin-only per 20260714120000). Admin reviews and acts on
-- these manually.
alter table public.orders
  add column if not exists customer_confirmed_at timestamptz,
  add column if not exists cancellation_requested_at timestamptz;
