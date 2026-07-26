-- Adds the new /market-prices page to the per-user grantable page whitelist
-- (see 20260723100000_staff_page_access.sql) — same signature, only the
-- allowed_pages array changes, so a plain CREATE OR REPLACE is safe here
-- (no param reordering involved).
create or replace function public.set_staff_page_access(target_user_id uuid, pages text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_pages text[] := array[
    'meta-events', 'courier', 'daraz', 'analysis', 'insights', 'areas',
    'notifications', 'feedback-requests', 'whatsapp-messages', 'logs', 'database',
    'market-prices'
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
