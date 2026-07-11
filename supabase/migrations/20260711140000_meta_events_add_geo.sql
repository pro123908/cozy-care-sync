-- Best-effort IP geolocation so admins can see which areas traffic comes from.
alter table public.meta_events
  add column if not exists geo_city text,
  add column if not exists geo_region text,
  add column if not exists geo_country text;
