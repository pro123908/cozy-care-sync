-- Web Push subscriptions for the admin panel + a trigger that fires on every
-- new order so admins/staff get a push notification on their phone/desktop
-- the moment an order is placed (see supabase/functions/send-order-push).

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Table: one row per subscribed browser/device.
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Only an admin/staff user may manage their own subscription row. The
-- send-order-push edge function reads via the service-role key, which
-- bypasses RLS entirely.
--
-- SELECT and UPDATE policies are required here even though the client never
-- reads this table directly: Postgres needs a permissive SELECT policy to
-- satisfy `INSERT ... RETURNING` (the row must be "visible" to be returned),
-- and an UPDATE policy for the ON CONFLICT DO UPDATE branch of the client's
-- upsert() call. Without them Postgres raises a misleading
-- "new row violates row-level security policy" error even though the INSERT
-- itself would otherwise be allowed.
drop policy if exists "Admins can read own push subscription" on public.push_subscriptions;
create policy "Admins can read own push subscription"
  on public.push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id and public.is_admin());

drop policy if exists "Admins can insert own push subscription" on public.push_subscriptions;
create policy "Admins can insert own push subscription"
  on public.push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id and public.is_admin());

drop policy if exists "Admins can update own push subscription" on public.push_subscriptions;
create policy "Admins can update own push subscription"
  on public.push_subscriptions for update
  to authenticated
  using (auth.uid() = user_id and public.is_admin())
  with check (auth.uid() = user_id and public.is_admin());

drop policy if exists "Admins can delete own push subscription" on public.push_subscriptions;
create policy "Admins can delete own push subscription"
  on public.push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id and public.is_admin());

-- ---------------------------------------------------------------------------
-- Trigger: notify on every new order (mirrors notify_order_delivered()).
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
begin
  perform net.http_post(
    url := 'https://dkspvlpswpipltceptoa.supabase.co/functions/v1/send-order-push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'orders',
      'record', to_jsonb(new)
    )
  );
  return new;
end;
$$;

drop trigger if exists orders_new_order_push on public.orders;
create trigger orders_new_order_push
after insert on public.orders
for each row
execute function public.notify_new_order();
