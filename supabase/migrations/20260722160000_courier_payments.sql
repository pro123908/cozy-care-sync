-- Leopards' COD payment/cheque reconciliation data (getInvoices,
-- getPaymentDetails, getShippingCharges in their Merchant API v2 docs) —
-- previously only available as a printed/scanned sheet from Leopards'
-- finance team. Two tables, mirroring the two sections of that sheet:
--
-- courier_invoices: one row per cheque Leopards has issued (their
-- getInvoices endpoint — no date-range or CN filter documented, so the
-- sync route fetches and upserts the full list each run).
--
-- courier_payments: one row per shipment (CN number), upserted from
-- getPaymentDetails (which cheque it's on) + getShippingCharges (the
-- actual charge breakdown) merged together — same "upsert by Leopards'
-- own identifier" convention as courier_bookings/courier_shipper_advice.
-- order_id isn't returned by either endpoint; the sync route fills it in
-- from courier_bookings.order_id by matching on tracking_number = cn_number.

create table if not exists public.courier_invoices (
  invoice_cheque_no          text primary key,
  invoice_cheque_date        text,
  invoice_cheque_holder_name text,
  invoice_cheque_amount      numeric,
  bank_name                  text,
  payment_method_name        text,
  pay_status_name            text,
  synced_at                  timestamptz not null default now()
);

alter table public.courier_invoices enable row level security;

drop policy if exists "Staff can read courier invoices" on public.courier_invoices;
create policy "Staff can read courier invoices"
  on public.courier_invoices for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Staff can upsert courier invoices" on public.courier_invoices;
create policy "Staff can upsert courier invoices"
  on public.courier_invoices for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Staff can update courier invoices" on public.courier_invoices;
create policy "Staff can update courier invoices"
  on public.courier_invoices for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.courier_payments (
  cn_number                 text primary key,
  order_id                  text,
  invoice_cheque_no         text,
  invoice_cheque_date       text,
  billing_method            text,
  payment_status            text,
  payment_method            text,
  weight_charged             numeric,
  shipment_charges           numeric,
  cash_handling_charges      numeric,
  return_charges             numeric,
  insurance_charges          numeric,
  fuel_surcharge_percentage  numeric,
  fuel_surcharge_amount      numeric,
  gst_percentage             numeric,
  gst_amount                 numeric,
  collect_amount             numeric,
  billed_charges             numeric,
  net_charges                numeric,
  gross_charges              numeric,
  synced_at                  timestamptz not null default now()
);

create index if not exists courier_payments_invoice_idx on public.courier_payments (invoice_cheque_no);
create index if not exists courier_payments_order_id_idx on public.courier_payments (order_id);

alter table public.courier_payments enable row level security;

drop policy if exists "Staff can read courier payments" on public.courier_payments;
create policy "Staff can read courier payments"
  on public.courier_payments for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Staff can upsert courier payments" on public.courier_payments;
create policy "Staff can upsert courier payments"
  on public.courier_payments for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Staff can update courier payments" on public.courier_payments;
create policy "Staff can update courier payments"
  on public.courier_payments for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
