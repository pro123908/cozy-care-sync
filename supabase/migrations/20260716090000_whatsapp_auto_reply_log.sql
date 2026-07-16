-- Tracks when the automation number (+92 339 0104375, on WhatsApp Cloud API)
-- last sent its "please contact us on our support number" auto-reply to a given
-- customer. Without this, a customer sending several messages in a row (e.g. a
-- burst of voice notes, which is how Well Care Mart customers actually talk)
-- would get an identical bot reply to each one.
--
-- Only the edge function (service_role) touches this — RLS on with no policies
-- means no anon/authenticated access at all.
create table if not exists public.whatsapp_auto_reply_log (
  phone text primary key,
  last_replied_at timestamptz not null default now()
);

alter table public.whatsapp_auto_reply_log enable row level security;
