-- Persists each AI Insights generation from the admin panel's /insights page
-- (Claude-written summary/recommendations/flags over a sales+inventory+ads
-- forecast snapshot) so a refresh doesn't lose it and past runs stay
-- reviewable. Append-only log, same shape as audit_logs: admins can read,
-- and — unlike audit_logs, which is only ever written by a trigger — the
-- admin panel inserts a row directly (client-side, PostgREST + RLS) right
-- after Claude responds, matching this app's usual "no server layer"
-- write pattern for admin actions.

create table if not exists public.ai_insights (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id) on delete set null,
  summary            text not null,
  recommendations    text[] not null default '{}',
  flags              text[] not null default '{}',
  input_tokens       integer,
  output_tokens      integer,
  estimated_cost_usd numeric(10,6),
  -- The compact stats snapshot sent to Claude (sales/inventory/ads
  -- forecast numbers) — kept alongside the response so a past insight can
  -- be understood without re-deriving what prompted it.
  request_summary    jsonb
);

create index if not exists ai_insights_created_at_idx on public.ai_insights (created_at desc);

alter table public.ai_insights enable row level security;

drop policy if exists "Admins can read ai insights" on public.ai_insights;
create policy "Admins can read ai insights"
  on public.ai_insights for select
  to authenticated
  using (public.is_full_admin());

drop policy if exists "Admins can insert ai insights" on public.ai_insights;
create policy "Admins can insert ai insights"
  on public.ai_insights for insert
  to authenticated
  with check (public.is_full_admin());
