-- Market Price Comparison: tracks matches between our products and listings
-- for the same/similar item on named competitor sites (dvago.pk,
-- lifecare.com.pk, beurer.pk), scraped on demand from app/api/market-prices/*
-- (no cron/queue backing this — every scan is a staff-triggered action).
--
-- Matching is automatic (name-similarity scoring, see lib/market-prices/match.ts)
-- but not blindly trusted: `status` starts at 'auto_matched' and staff can
-- confirm or reject a match from the /market-prices page, since automatic
-- matching across three independent catalogs will sometimes pick the wrong
-- pack size/variant or nothing at all.
create table if not exists public.market_price_matches (
  id                uuid primary key default gen_random_uuid(),
  product_id        text not null references public.products(id) on delete cascade,
  source            text not null check (source in ('dvago', 'lifecare', 'beurer')),
  competitor_url    text not null,
  competitor_name   text not null,
  match_confidence  numeric,
  status            text not null default 'auto_matched'
                       check (status in ('auto_matched', 'confirmed', 'rejected')),
  last_price        numeric,
  last_checked_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (product_id, source)
);

alter table public.market_price_matches enable row level security;

drop policy if exists "Staff can read market price matches" on public.market_price_matches;
create policy "Staff can read market price matches"
  on public.market_price_matches for select
  to authenticated
  using (public.is_admin() or public.is_viewer());

drop policy if exists "Staff can write market price matches" on public.market_price_matches;
create policy "Staff can write market price matches"
  on public.market_price_matches for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create index if not exists market_price_matches_product_id_idx
  on public.market_price_matches (product_id);

-- Append-only price log per match, so the detail modal can show a trend
-- (sparkline) instead of just the latest scraped price.
create table if not exists public.market_price_history (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.market_price_matches(id) on delete cascade,
  price      numeric not null,
  checked_at timestamptz not null default now()
);

alter table public.market_price_history enable row level security;

drop policy if exists "Staff can read market price history" on public.market_price_history;
create policy "Staff can read market price history"
  on public.market_price_history for select
  to authenticated
  using (public.is_admin() or public.is_viewer());

drop policy if exists "Staff can insert market price history" on public.market_price_history;
create policy "Staff can insert market price history"
  on public.market_price_history for insert
  to authenticated
  with check (public.is_admin());

create index if not exists market_price_history_match_id_idx
  on public.market_price_history (match_id, checked_at desc);
