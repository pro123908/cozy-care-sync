-- Normalize punctuation to spaces on the INDEXING side, not just the query
-- side. Root cause found while chasing why "k89" didn't find "Axon K-89
-- Rechargeable Hearing Aid" even after 20260723030000 (which splits the
-- *query* at letter/digit boundaries): Postgres's default text search
-- parser has a quirk where a hyphen sitting directly between a letter and
-- digits with no surrounding whitespace (e.g. "K-89", no space anywhere)
-- gets tokenized as a lexeme that keeps the hyphen glued to the number
-- ('-89'), not a clean '89' — confirmed directly:
--   to_tsvector('english', 'Axon K-89 Rechargeable Hearing Aid')
--     -> 'axon':1 'k':2 '-89':3 'recharg':4 'hear':5 'aid':6
-- A query-side prefix search for '89:*' can never match a lexeme that
-- literally starts with '-', so this was unreachable no matter how the
-- query was normalized. Same quirk affects hear-002's own tag
-- ("Axon K-86" -> '-86', not '86') — it only worked earlier because that
-- product's `name` field happens to use a space ("K 86") instead of a
-- hyphen, dodging the bug by luck rather than fixing it. Every hyphenated
-- model code in the catalog has this same latent problem, on both name and
-- tags.
--
-- Fix: strip/space-ify all punctuation from each field's text *before*
-- feeding it to to_tsvector, exactly mirroring the normalization already
-- applied to the incoming query (see 20260702150000/20260723030000).
-- "Axon K-89 ..." -> "Axon K 89 ..." tokenizes cleanly as 'k','89'.
create or replace function public.products_search_vector_update()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', regexp_replace(coalesce(new.name, ''), '[^a-zA-Z0-9]+', ' ', 'g')), 'A') ||
    setweight(
      to_tsvector('english', regexp_replace(
        coalesce(new.brand, '') || ' ' || array_to_string(coalesce(new.tags, '{}'), ' '),
        '[^a-zA-Z0-9]+', ' ', 'g'
      )),
      'B'
    ) ||
    setweight(to_tsvector('english', regexp_replace(coalesce(new.blurb, ''), '[^a-zA-Z0-9]+', ' ', 'g')), 'C') ||
    setweight(to_tsvector('english', regexp_replace(coalesce(new.cat, ''), '[^a-zA-Z0-9]+', ' ', 'g')), 'D');
  return new;
end;
$$;

-- Back-fill existing rows immediately rather than waiting for their next
-- unrelated update to fire the trigger.
update public.products set
  search_vector =
    setweight(to_tsvector('english', regexp_replace(coalesce(name, ''), '[^a-zA-Z0-9]+', ' ', 'g')), 'A') ||
    setweight(
      to_tsvector('english', regexp_replace(
        coalesce(brand, '') || ' ' || array_to_string(coalesce(tags, '{}'), ' '),
        '[^a-zA-Z0-9]+', ' ', 'g'
      )),
      'B'
    ) ||
    setweight(to_tsvector('english', regexp_replace(coalesce(blurb, ''), '[^a-zA-Z0-9]+', ' ', 'g')), 'C') ||
    setweight(to_tsvector('english', regexp_replace(coalesce(cat, ''), '[^a-zA-Z0-9]+', ' ', 'g')), 'D');
