-- Leopards' getAllCities was being called live on every "Book Courier"
-- modal open (app/api/courier/cities/route.ts), with only an in-memory
-- cache — unreliable on serverless (each invocation can be a fresh
-- instance) and re-fetches the whole ~830-city list far more than needed
-- since it barely changes. This stores it durably instead, refreshed only
-- via an explicit admin-triggered sync (sync_courier_cities below).
create table if not exists public.courier_cities (
  leopards_id            integer primary key,
  name                   text not null,
  allow_as_origin        boolean not null default true,
  allow_as_destination   boolean not null default true,
  shipment_type          text[] not null default '{}',
  synced_at              timestamptz not null default now()
);

create index if not exists courier_cities_name_idx on public.courier_cities (name);

alter table public.courier_cities enable row level security;

-- Same visibility as the booking feature itself (requireStaffOrAdmin).
drop policy if exists "Staff can view courier cities" on public.courier_cities;
create policy "Staff can view courier cities"
  on public.courier_cities for select
  to authenticated
  using (public.is_admin());

-- Full mirror sync: upserts everything Leopards currently returns, and
-- removes any row no longer present (a city Leopards stopped serving).
-- Takes the already-fetched JSON array (the API route does the actual
-- Leopards HTTP call — this function only ever touches the DB) so the
-- Leopards credentials stay server-side in the route, not in SQL.
create or replace function public.sync_courier_cities(p_cities jsonb)
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

  -- Leopards returning an empty/malformed list must never be interpreted as
  -- "every city was removed" — refuse rather than wipe the table.
  if p_cities is null or jsonb_array_length(p_cities) = 0 then
    raise exception 'No cities provided - refusing to sync';
  end if;

  insert into public.courier_cities (leopards_id, name, allow_as_origin, allow_as_destination, shipment_type, synced_at)
  select
    (c->>'id')::integer,
    -- A handful of real Leopards city names come back with a trailing
    -- \r\n baked into the string (e.g. "ADAM ZAI\r\n") - plain trim()
    -- only strips spaces, not CR/LF, so this needs an explicit char list.
    trim(both E' \t\r\n' from c->>'name'),
    coalesce((c->>'allow_as_origin')::boolean, true),
    coalesce((c->>'allow_as_destination')::boolean, true),
    coalesce((select array_agg(elem) from jsonb_array_elements_text(c->'shipment_type') as elem), '{}'),
    now()
  from jsonb_array_elements(p_cities) as c
  on conflict (leopards_id) do update
    set name = excluded.name,
        allow_as_origin = excluded.allow_as_origin,
        allow_as_destination = excluded.allow_as_destination,
        shipment_type = excluded.shipment_type,
        synced_at = now();
  get diagnostics v_synced = row_count;

  delete from public.courier_cities
  where leopards_id not in (
    select (c->>'id')::integer from jsonb_array_elements(p_cities) as c
  );
  get diagnostics v_removed = row_count;

  return query select v_synced, v_removed;
end;
$$;
