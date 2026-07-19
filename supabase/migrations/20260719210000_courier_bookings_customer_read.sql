-- Lets a logged-in customer read courier tracking for their own orders
-- (matches the "My Orders" account view, not the guest /track-order flow
-- which already gets this via the guest-order-lookup edge function's
-- service-role access). Mirrors the one RLS pattern that's actually
-- enforced on orders itself (`auth.uid() = user_id` — there's no working
-- email-based guest policy there, so this doesn't add one either).
create policy "Customers can read their own courier bookings"
  on public.courier_bookings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.order_code = courier_bookings.order_id
        and orders.user_id = auth.uid()
    )
  );
