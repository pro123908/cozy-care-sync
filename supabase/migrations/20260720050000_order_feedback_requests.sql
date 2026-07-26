-- Tracks every "thank you / please leave feedback" WhatsApp send fired from
-- the admin panel for a delivered order, so staff can see which orders
-- already got one (and which template variant) instead of risking a
-- duplicate send. Written only by the send-feedback-request edge function
-- via the service-role key.
create table if not exists public.order_feedback_requests (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  order_code text not null,
  variant    text not null check (variant in ('ontime', 'late')),
  sent_at    timestamptz not null default now()
);

create index if not exists order_feedback_requests_order_id_idx on public.order_feedback_requests (order_id);

alter table public.order_feedback_requests enable row level security;

drop policy if exists "Admins can view feedback requests" on public.order_feedback_requests;
create policy "Admins can view feedback requests"
  on public.order_feedback_requests for select
  to authenticated
  using (public.is_admin() or public.is_viewer());
