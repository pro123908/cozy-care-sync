-- Allow admins to delete orders from the admin panel.
-- Previously only SELECT and UPDATE policies existed for admins,
-- causing silent no-op deletes due to RLS blocking the operation.

DROP POLICY IF EXISTS "Admins can delete all orders" ON public.orders;

CREATE POLICY "Admins can delete all orders"
ON public.orders
FOR DELETE
TO authenticated
USING (public.is_admin());
