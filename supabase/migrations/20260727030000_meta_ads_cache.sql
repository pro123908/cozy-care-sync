-- Persists Meta Ads data into our own tables so it survives an ad being
-- deleted on Meta's side. Meta's /ads edge permanently refuses to return
-- deleted ad objects ("Cannot request deleted objects", error_subcode
-- 1815001, confirmed live) — once deleted, an ad's name/campaign/targeting
-- is gone forever via the API, no workaround. Same snapshot principle as
-- orders.items' cost_price: capture the data while it's available.
--
-- Populated by the meta-ads-sync edge function (service-role client, bypasses
-- RLS below), scheduled via pg_cron in the sibling migration. Read by
-- admin-app's /ads report export.

create table if not exists public.meta_ads_cache (
  ad_id            text primary key,
  name             text not null,
  status           text not null,
  effective_status text not null,
  campaign_name    text,
  objective        text,
  adset_name       text,
  age_min          integer,
  age_max          integer,
  genders          text,
  locations        jsonb not null default '[]'::jsonb,
  daily_budget     numeric,
  lifetime_budget  numeric,
  thumbnail_url    text,
  image_url        text,
  headline         text,
  message          text,
  link             text,
  -- An ad that stops appearing in a sync simply stops getting last_seen_at
  -- bumped — the row itself is never touched or deleted, which is the whole
  -- point (it's the only place that ad's data still exists once Meta
  -- refuses to return it).
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- One row per ad per day, not just a running total — required so the report
-- stays accurate for an arbitrary date range even for an ad that's since
-- been deleted, same reason order line items snapshot per-unit price rather
-- than only an order-level total.
create table if not exists public.meta_ads_daily_stats (
  ad_id           text not null references public.meta_ads_cache(ad_id) on delete cascade,
  date            date not null,
  spend           numeric not null default 0,
  impressions     integer not null default 0,
  reach           integer not null default 0,
  clicks          integer not null default 0,
  purchases       integer not null default 0,
  purchase_value  numeric not null default 0,
  synced_at       timestamptz not null default now(),
  primary key (ad_id, date)
);

alter table public.meta_ads_cache enable row level security;
alter table public.meta_ads_daily_stats enable row level security;

-- Read access matches exactly who can already see admin-app's /ads page
-- today (requireStaffOrAdmin() -> is_admin() RPC). No insert/update/delete
-- policy — written only by the sync edge function's service-role client,
-- which bypasses RLS entirely (same convention as
-- whatsapp_template_analytics_cache).
create policy "Staff can read meta ads cache"
  on public.meta_ads_cache for select to authenticated
  using (public.is_admin());

create policy "Staff can read meta ads daily stats"
  on public.meta_ads_daily_stats for select to authenticated
  using (public.is_admin());

revoke all on public.meta_ads_cache from anon, public;
revoke all on public.meta_ads_daily_stats from anon, public;
grant select on public.meta_ads_cache to authenticated;
grant select on public.meta_ads_daily_stats to authenticated;
grant all on public.meta_ads_cache to service_role;
grant all on public.meta_ads_daily_stats to service_role;
