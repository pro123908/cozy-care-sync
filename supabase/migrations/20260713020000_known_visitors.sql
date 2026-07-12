-- Lets admins label specific IP addresses (e.g. their own, or a teammate's)
-- so the Meta Events activity log can show a name instead of a masked IP
-- for recognized first-party/test traffic. Not an identity system — just an
-- admin-maintained lookup, since IPs can change (dynamic home/mobile IPs),
-- so labels will need occasional upkeep.
create table if not exists public.known_visitors (
  ip_address text primary key,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.known_visitors enable row level security;

-- Same admin+staff-read / admin+staff-write shape as product_costs, minus
-- the read/write split — a visitor label isn't sensitive like wholesale
-- cost, so staff can manage these too.
create policy "Admins can read known visitors"
  on public.known_visitors for select to authenticated using (public.is_admin());
create policy "Admins can insert known visitors"
  on public.known_visitors for insert to authenticated with check (public.is_admin());
create policy "Admins can update known visitors"
  on public.known_visitors for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete known visitors"
  on public.known_visitors for delete to authenticated using (public.is_admin());

revoke all on public.known_visitors from anon, public;
grant select, insert, update, delete on public.known_visitors to authenticated;
grant all on public.known_visitors to service_role;

insert into public.known_visitors (ip_address, label)
values ('202.47.37.116', 'Bilal')
on conflict (ip_address) do update set label = excluded.label, updated_at = now();
