-- Leopards' Merchant API has no "list load sheets" endpoint — only
-- generateLoadSheet (returns a load_sheet_id) and downloadLoadSheet (fetches
-- the PDF for a given id). Without our own record of what's been generated,
-- staff would have no way to find/re-download a past load sheet, so this
-- table is written to ourselves (from app/api/courier/generate-loadsheet)
-- right after every successful Leopards call, purely as our own history —
-- Leopards holds no equivalent list to sync against.
create table if not exists public.courier_load_sheets (
  load_sheet_id text primary key,
  cn_numbers    text[] not null,
  courier_name  text,
  courier_code  text,
  generated_at  timestamptz not null default now()
);

alter table public.courier_load_sheets enable row level security;

-- Same visibility as the rest of the courier feature (courier_bookings,
-- courier_shipper_advice): staff/admin write, staff/admin/viewer read.
drop policy if exists "Staff can read load sheets" on public.courier_load_sheets;
create policy "Staff can read load sheets"
  on public.courier_load_sheets for select
  to authenticated
  using (public.is_admin() or public.is_viewer());

drop policy if exists "Staff can insert load sheets" on public.courier_load_sheets;
create policy "Staff can insert load sheets"
  on public.courier_load_sheets for insert
  to authenticated
  with check (public.is_admin());
