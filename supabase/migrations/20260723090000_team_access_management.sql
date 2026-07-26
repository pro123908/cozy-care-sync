-- Backs the new admin-app "Team & Access" page: lets full admins list every
-- profile (needed to show who has staff/viewer/admin access) and fixes a
-- privilege-escalation hole in role management.
--
-- The hole: both the self-role-change trigger
-- (prevent_unauthorized_profile_role_change) and the set_profile_role() RPC
-- were guarded by is_admin(), which returns true for role IN ('admin',
-- 'staff') — not just full admins. Combined with the existing "users can
-- update own profile" RLS policy (auth.uid() = id, no column restriction),
-- a staff account could run
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', myId)
-- directly and self-promote to full admin: the trigger's `NOT is_admin()`
-- check was false for them since staff already satisfies is_admin(). The RPC
-- had the same guard and so the same hole. Both now require is_full_admin().

create or replace function public.prevent_unauthorized_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_full_admin() then
    raise exception 'Only admins can change profile roles';
  end if;

  return new;
end;
$$;

create or replace function public.set_profile_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_full_admin() then
    raise exception 'Only admins can set profile roles';
  end if;

  if new_role not in ('customer', 'staff', 'admin', 'viewer') then
    raise exception 'Invalid role: %', new_role;
  end if;

  update public.profiles
  set role = new_role,
      updated_at = now()
  where id = target_user_id;

  if not found then
    raise exception 'Profile not found for id %', target_user_id;
  end if;
end;
$$;

-- profiles previously had no admin-facing SELECT policy at all — only
-- "view own row" — so there was no way to list who has staff/viewer/admin
-- access. Full admins only (this is a people/access-management surface, not
-- something staff or viewer should see the full user roster through).
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles
for select
to authenticated
using (public.is_full_admin());
