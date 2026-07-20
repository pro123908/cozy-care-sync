-- Local cache of Leopards Courier bookings for the admin panel's /courier
-- page. Leopards' merchant API has no documented rate limit, so rather than
-- calling it on every page load, the admin page reads from this table and
-- only hits Leopards when there's nothing cached yet for the requested date
-- range, or when the admin explicitly clicks refresh. Upserted (not
-- append-only like ai_insights) — a booking's status changes over time and
-- tracking_number is Leopards' stable identifier, so each sync just
-- overwrites the row with the latest known status.

create table if not exists public.courier_bookings (
  tracking_number    text primary key,
  order_id           text,
  booking_date       date,
  delivery_date      date,
  origin_city        text,
  destination_city   text,
  consignee_name     text,
  consignee_phone    text,
  consignee_address  text,
  status             text,
  cod_value          numeric,
  weight             numeric,
  synced_at          timestamptz not null default now()
);

create index if not exists courier_bookings_booking_date_idx on public.courier_bookings (booking_date desc);
create index if not exists courier_bookings_order_id_idx on public.courier_bookings (order_id);

alter table public.courier_bookings enable row level security;

drop policy if exists "Staff can read courier bookings" on public.courier_bookings;
create policy "Staff can read courier bookings"
  on public.courier_bookings for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Staff can upsert courier bookings" on public.courier_bookings;
create policy "Staff can upsert courier bookings"
  on public.courier_bookings for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Staff can update courier bookings" on public.courier_bookings;
create policy "Staff can update courier bookings"
  on public.courier_bookings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
