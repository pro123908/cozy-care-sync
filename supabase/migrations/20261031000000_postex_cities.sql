-- Storefront checkout's city picker used a hardcoded ~120-city list merged with
-- Leopards' ~827 courier_cities, neither of which says whether PostEx (the
-- courier we actually ship with) delivers there. PostEx's real delivery-city
-- list was only fetched live inside the admin app (/api/postex/cities, needs
-- the PostEx token + a staff session). This mirrors it into a table the public
-- storefront can read; the admin route refreshes it every time it successfully
-- fetches PostEx's list. Nothing here is sensitive (just city names).
create table if not exists public.postex_cities (
  name       text primary key,
  synced_at  timestamptz not null default now()
);

alter table public.postex_cities enable row level security;

drop policy if exists "Public can view postex cities" on public.postex_cities;
create policy "Public can view postex cities"
  on public.postex_cities for select
  to anon, authenticated
  using (true);

-- Full mirror sync, same contract as sync_courier_cities: upserts the given
-- names and removes any no longer present. An empty list is refused so a
-- failed/blank PostEx response can never wipe the table (which would leave
-- the storefront with no selectable cities).
create or replace function public.sync_postex_cities(p_cities text[])
returns table(synced integer, removed integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_synced integer;
  v_removed integer;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if p_cities is null or cardinality(p_cities) = 0 then
    raise exception 'No cities provided - refusing to sync';
  end if;

  insert into public.postex_cities (name, synced_at)
  select distinct trim(both E' \t\r\n' from c), now()
  from unnest(p_cities) as c
  where trim(both E' \t\r\n' from c) <> ''
  on conflict (name) do update set synced_at = now();
  get diagnostics v_synced = row_count;

  delete from public.postex_cities
  where name not in (select trim(both E' \t\r\n' from c) from unnest(p_cities) as c);
  get diagnostics v_removed = row_count;

  return query select v_synced, v_removed;
end;
$$;

revoke all on function public.sync_postex_cities(text[]) from public, anon;
grant execute on function public.sync_postex_cities(text[]) to authenticated;
