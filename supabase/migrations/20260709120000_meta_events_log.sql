-- Log of Meta Pixel / Conversions API events we attempt to send, so admins
-- can see delivery status in the admin panel instead of digging through
-- Supabase function logs or Meta Events Manager.
create table if not exists public.meta_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null, -- 'client-event' (meta-track fn) or 'order-purchase' (place-order fn)
  event_name text not null,
  event_id text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  reason text,
  value numeric,
  currency text,
  num_items integer,
  content_ids text[],
  has_email boolean not null default false,
  has_phone boolean not null default false,
  event_source_url text,
  fbtrace_id text
);

create index if not exists meta_events_created_at_idx on public.meta_events (created_at desc);
create index if not exists meta_events_event_name_idx on public.meta_events (event_name);

-- Enable RLS. Edge functions write via the service-role key, which bypasses
-- RLS entirely, so only a read policy for admins/staff is required.
alter table public.meta_events enable row level security;

create policy "Admins can view all meta events"
  on public.meta_events for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );
