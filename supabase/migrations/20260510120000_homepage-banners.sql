-- Homepage banner images for storefront hero carousel.
create table if not exists public.homepage_banners (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.homepage_banners enable row level security;

drop policy if exists "Homepage banners are publicly readable" on public.homepage_banners;
create policy "Homepage banners are publicly readable"
on public.homepage_banners
for select
to public
using (active = true);

drop policy if exists "Admins can read all homepage banners" on public.homepage_banners;
create policy "Admins can read all homepage banners"
on public.homepage_banners
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert homepage banners" on public.homepage_banners;
create policy "Admins can insert homepage banners"
on public.homepage_banners
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update homepage banners" on public.homepage_banners;
create policy "Admins can update homepage banners"
on public.homepage_banners
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete homepage banners" on public.homepage_banners;
create policy "Admins can delete homepage banners"
on public.homepage_banners
for delete
to authenticated
using (public.is_admin());
