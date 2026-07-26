-- Single-row store for the Daraz Open Platform OAuth token (app "Wellcare
-- Mart Inventory Sync", AppKey 505590), captured by the admin-app's
-- /api/daraz/callback route after the seller completes the "Code for token"
-- authorization flow. Singleton table (id is always true) since there's
-- only one Daraz seller account in play — no per-user rows needed.
-- Full-admin only: this holds a live access_token/refresh_token pair, same
-- sensitivity tier as the other privileged-token surfaces in this schema.

create table if not exists public.daraz_auth (
  id                  boolean primary key default true,
  access_token        text not null,
  refresh_token       text not null,
  expires_at          timestamptz not null,
  refresh_expires_at  timestamptz,
  account             text,
  seller_id           text,
  updated_at          timestamptz not null default now(),
  constraint daraz_auth_singleton check (id)
);

alter table public.daraz_auth enable row level security;

drop policy if exists "Full admin can read daraz auth" on public.daraz_auth;
create policy "Full admin can read daraz auth"
  on public.daraz_auth for select
  to authenticated
  using (public.is_full_admin());

drop policy if exists "Full admin can upsert daraz auth" on public.daraz_auth;
create policy "Full admin can upsert daraz auth"
  on public.daraz_auth for insert
  to authenticated
  with check (public.is_full_admin());

drop policy if exists "Full admin can update daraz auth" on public.daraz_auth;
create policy "Full admin can update daraz auth"
  on public.daraz_auth for update
  to authenticated
  using (public.is_full_admin())
  with check (public.is_full_admin());
