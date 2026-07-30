-- Stable client-generated visitor id (localStorage UUID), threaded through
-- from the client via meta-track/place-order so admin-side "unique visits"
-- can count real visitors instead of approximating uniqueness from IP
-- address (which both over-counts shared NAT/office wifi as one visitor and
-- under-counts one visitor switching networks as several).
alter table public.meta_events add column if not exists visitor_id text;

create index if not exists meta_events_visitor_id_idx on public.meta_events (visitor_id);
