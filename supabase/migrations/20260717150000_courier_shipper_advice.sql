-- Leopards' shipperAdviceList: shipments that hit a delivery issue and are
-- waiting on the shipper (us) to decide re-attempt vs. return — a distinct
-- concept from a booking's regular status, tracked as its own list on
-- Leopards' side (see shipperAdviceList / updateShipperAdvice in their
-- Merchant API docs). Mirrors courier_bookings: upserted by cn_number, kept
-- as full rows (not just a count) so a future page can drill into what's
-- actually pending, not just show a tile number.
--
-- Field types are intentionally loose (text, not date/numeric) — the API
-- doc's schema for this endpoint has known inconsistencies (it documents
-- two different response shapes for the same endpoint), and we have no real
-- sample data yet to confirm exact formats.

create table if not exists public.courier_shipper_advice (
  cn_number             text primary key,
  status                text,
  shipper_advice_status text,
  reason                text,
  consignee_name        text,
  consignee_phone       text,
  consignee_address     text,
  origin_city           text,
  destination_city      text,
  created_date          text,
  synced_at             timestamptz not null default now()
);

alter table public.courier_shipper_advice enable row level security;

drop policy if exists "Staff can read shipper advice" on public.courier_shipper_advice;
create policy "Staff can read shipper advice"
  on public.courier_shipper_advice for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Staff can upsert shipper advice" on public.courier_shipper_advice;
create policy "Staff can upsert shipper advice"
  on public.courier_shipper_advice for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Staff can update shipper advice" on public.courier_shipper_advice;
create policy "Staff can update shipper advice"
  on public.courier_shipper_advice for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
