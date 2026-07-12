-- Capture the storefront search term for Search events so the admin
-- dashboard can show what visitors are actually searching for.
alter table public.meta_events
  add column if not exists search_string text;
