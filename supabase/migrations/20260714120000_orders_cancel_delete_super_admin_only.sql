-- Restrict cancelling and deleting orders to a single super-admin account
-- (pro123908@gmail.com). All other order management (viewing, updating to
-- any status other than 'Cancelled') remains open to any admin/staff via
-- the existing is_admin() check.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.email() = 'pro123908@gmail.com';
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Only the super admin may transition an order's status to 'Cancelled'.
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;

CREATE POLICY "Admins can update all orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (
  public.is_admin()
  AND (status IS DISTINCT FROM 'Cancelled' OR public.is_super_admin())
);

-- Only the super admin may delete orders outright.
DROP POLICY IF EXISTS "Admins can delete all orders" ON public.orders;

CREATE POLICY "Admins can delete all orders"
ON public.orders
FOR DELETE
TO authenticated
USING (public.is_super_admin());
