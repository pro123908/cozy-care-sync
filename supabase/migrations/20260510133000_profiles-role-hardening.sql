-- Prevent authenticated users from self-escalating roles via profile updates.

-- Keep users able to update their own basic profile fields.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Guard role changes at the row level.
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change profile roles';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_unauthorized_profile_role_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_unauthorized_profile_role_change_trigger ON public.profiles;
CREATE TRIGGER prevent_unauthorized_profile_role_change_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unauthorized_profile_role_change();

-- Admin utility function for controlled role management.
CREATE OR REPLACE FUNCTION public.set_profile_role(target_user_id UUID, new_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can set profile roles';
  END IF;

  IF new_role NOT IN ('customer', 'staff', 'admin') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  UPDATE public.profiles
  SET role = new_role,
      updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for id %', target_user_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_profile_role(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_profile_role(UUID, TEXT) TO authenticated;
