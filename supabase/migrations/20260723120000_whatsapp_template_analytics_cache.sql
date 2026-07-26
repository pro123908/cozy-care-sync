-- Backs a server-side cache for the whatsapp-template-analytics edge
-- function: that function makes up to 4 templates * 2 pages = 8 sequential
-- round trips to Meta's Graph API per call, which measured ~7-8s live
-- (2026-07-23) — too slow to re-run on every WhatsApp Messages page load.
-- Single-row cache (id is always 1) since this feature only ever asks for
-- one shape of query (last 30 days, all tracked templates); the edge
-- function checks freshness itself before deciding whether to hit Meta.
--
-- RLS enabled with zero policies: only ever touched via the edge function's
-- service-role client, which bypasses RLS entirely — nothing else needs
-- direct access.
create table if not exists public.whatsapp_template_analytics_cache (
  id smallint primary key default 1,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint whatsapp_template_analytics_cache_singleton check (id = 1)
);

alter table public.whatsapp_template_analytics_cache enable row level security;
