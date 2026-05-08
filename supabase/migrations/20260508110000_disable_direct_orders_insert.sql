-- Force order creation through backend edge function only.
-- Removes client-side direct INSERT capability from authenticated users.

DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
