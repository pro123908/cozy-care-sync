-- Per-user overrides on top of the role-based access model: lets a full
-- admin grant a specific staff/viewer account access to individual
-- admin-only pages (e.g. Courier) without promoting them to full admin.
-- Standard pages (Products, Orders, Fulfillment, etc.) are unaffected — those
-- stay automatic for any staff/viewer account, as before. "Team & Access"
-- itself is deliberately never grantable this way (enforced in the RPC's
-- whitelist below) — it's the page that hands out access, so widening it
-- stays a full-admin-only surface.

create table if not exists public.staff_page_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  page text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, page)
);

alter table public.staff_page_access enable row level security;

drop policy if exists "Users can read own page access" on public.staff_page_access;
create policy "Users can read own page access"
on public.staff_page_access
for select
to authenticated
using (auth.uid() = user_id or public.is_full_admin());

-- No direct insert/update/delete policies — all writes go through
-- set_staff_page_access() below so the page whitelist is enforced
-- server-side rather than trusted to the client.

create or replace function public.set_staff_page_access(target_user_id uuid, pages text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_pages text[] := array[
    'meta-events', 'courier', 'daraz', 'analysis', 'insights', 'areas',
    'notifications', 'feedback-requests', 'whatsapp-messages', 'logs', 'database'
  ];
  p text;
begin
  if not public.is_full_admin() then
    raise exception 'Only admins can set page access';
  end if;

  foreach p in array pages loop
    if not (p = any(allowed_pages)) then
      raise exception 'Invalid page: %', p;
    end if;
  end loop;

  delete from public.staff_page_access
  where user_id = target_user_id
    and page <> all(pages);

  insert into public.staff_page_access (user_id, page)
  select target_user_id, unnest(pages)
  on conflict (user_id, page) do nothing;
end;
$$;

revoke execute on function public.set_staff_page_access(uuid, text[]) from public, anon;
grant execute on function public.set_staff_page_access(uuid, text[]) to authenticated;
