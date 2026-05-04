-- Order reviews table
create table if not exists public.order_reviews (
  id uuid primary key default gen_random_uuid(),
  order_code text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  -- one review per order per user
  unique (order_code, user_id)
);

-- Enable RLS
alter table public.order_reviews enable row level security;

-- Users can read their own reviews
create policy "Users can view own reviews"
  on public.order_reviews for select
  using (auth.uid() = user_id);

-- Users can insert their own reviews
create policy "Users can insert own reviews"
  on public.order_reviews for insert
  with check (auth.uid() = user_id);

-- Admins can read all reviews
create policy "Admins can view all reviews"
  on public.order_reviews for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );
