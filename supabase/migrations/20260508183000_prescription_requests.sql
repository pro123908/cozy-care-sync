create table if not exists public.prescription_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  contact_name text not null,
  phone text not null,
  email text not null default '',
  city text not null default '',
  notes text not null default '',
  status text not null default 'Received',
  file_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists prescription_requests_created_at_idx
  on public.prescription_requests (created_at desc);

create index if not exists prescription_requests_status_idx
  on public.prescription_requests (status);

alter table public.prescription_requests enable row level security;

drop policy if exists "Anyone can submit prescription requests" on public.prescription_requests;
create policy "Anyone can submit prescription requests"
  on public.prescription_requests
  for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Admins can view prescription requests" on public.prescription_requests;
create policy "Admins can view prescription requests"
  on public.prescription_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can update prescription requests" on public.prescription_requests;
create policy "Admins can update prescription requests"
  on public.prescription_requests
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

insert into storage.buckets (id, name, public)
values ('prescriptions', 'prescriptions', false)
on conflict (id) do nothing;

drop policy if exists "Anyone can upload prescription files" on storage.objects;
create policy "Anyone can upload prescription files"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'prescriptions');

drop policy if exists "Admins can view prescription files" on storage.objects;
create policy "Admins can view prescription files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'prescriptions'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can update prescription files" on storage.objects;
create policy "Admins can update prescription files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'prescriptions'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    bucket_id = 'prescriptions'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can delete prescription files" on storage.objects;
create policy "Admins can delete prescription files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'prescriptions'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
