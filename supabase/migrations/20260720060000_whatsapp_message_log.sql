-- Unified log of every automated WhatsApp message sent by any edge function
-- in this project (order confirmations, shipment pickup notices, delivery
-- feedback requests, and the Confirm/Cancel tap acknowledgments) so the
-- admin panel can show one timeline across all of them, per order. Written
-- only by those functions via the service-role key.
--
-- Supersedes order_feedback_requests (created earlier the same day, never
-- held real data since the feedback templates were still pending Meta
-- approval) — folded into this table instead of keeping two overlapping
-- send-logs.
drop table if exists public.order_feedback_requests;

create table public.whatsapp_message_log (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid references public.orders(id) on delete set null,
  order_code    text not null,
  phone         text not null,
  message_type  text not null check (message_type in (
    'order_confirmation',
    'shipment_notification',
    'feedback_ontime',
    'feedback_late',
    'confirm_ack',
    'cancel_ack'
  )),
  template_name text,
  status        text not null default 'sent' check (status in ('sent', 'failed')),
  error_detail  text,
  created_at    timestamptz not null default now()
);

create index whatsapp_message_log_order_id_idx on public.whatsapp_message_log (order_id);
create index whatsapp_message_log_order_code_idx on public.whatsapp_message_log (order_code);
create index whatsapp_message_log_created_at_idx on public.whatsapp_message_log (created_at desc);

alter table public.whatsapp_message_log enable row level security;

create policy "Admins can view whatsapp message log"
  on public.whatsapp_message_log for select
  to authenticated
  using (public.is_admin() or public.is_viewer());
