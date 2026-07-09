-- Capture user agent + IP on meta_events so admins can identify the device
-- behind an event (e.g. distinguishing bots/test traffic from real users).
alter table public.meta_events
  add column if not exists user_agent text,
  add column if not exists ip_address text;
