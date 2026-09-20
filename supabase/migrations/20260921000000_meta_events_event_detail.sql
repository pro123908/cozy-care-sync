-- Generic per-event detail for events that need a little structured context
-- beyond content_ids/value. First user: BundleClick ({ "label": "<A> + <B>",
-- "source": "home page" | "deals page" | "product page" | "cart" }).
--
-- Deliberately NOT search_string: that column means "the literal search-box
-- query" (see 20260908030000_meta_events_reviewer_name_column.sql for the
-- cleanup after review events reused it for a person's name). Small flat
-- string->string object, sanitized in the meta-track edge function.
alter table public.meta_events add column if not exists event_detail jsonb;
