-- Teach full-text search that "bp" and "blood pressure" are the same
-- thing. Found while chasing why searching "bp monitor" didn't surface
-- "Electronic Blood Pressure Monitor" (bd-012, a real hot seller): most
-- products in this category abbreviate to "BP" in their name/tags (e.g.
-- "Medicare Digital BP Monitor"), but four products spell it out in full
-- ("Electronic Blood Pressure Monitor", "Life Care Wrist Digital Blood
-- Pressure Monitor", "Yuwell 610 Digital Blood Pressure Monitor", plus one
-- matched via blurb/tags) with no literal "bp" anywhere in their indexed
-- text at all — a query for "bp" has no lexeme to match against for those,
-- regardless of how the query itself gets normalized (that's a
-- query-side-only fix, and this gap is on the indexing side).
--
-- Fix: whenever "blood pressure" appears in a product's name/brand/tags/
-- blurb, append the literal word "bp" right after it before tokenizing —
-- this is index-only (search_vector is never displayed, only searched
-- against), so it doesn't change any visible product text. One-directional
-- by design: the reverse (query "blood pressure" finding "BP"-only text)
-- already works today via the other BP-abbreviated products' own tags
-- (confirmed: "blood pressure monitor" already returns 11 results).
create or replace function public.products_search_vector_update()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', regexp_replace(
      regexp_replace(coalesce(new.name, ''), 'blood\s+pressure', 'blood pressure bp', 'gi'),
      '[^a-zA-Z0-9]+', ' ', 'g'
    )), 'A') ||
    setweight(
      to_tsvector('english', regexp_replace(
        regexp_replace(
          coalesce(new.brand, '') || ' ' || array_to_string(coalesce(new.tags, '{}'), ' '),
          'blood\s+pressure', 'blood pressure bp', 'gi'
        ),
        '[^a-zA-Z0-9]+', ' ', 'g'
      )),
      'B'
    ) ||
    setweight(to_tsvector('english', regexp_replace(
      regexp_replace(coalesce(new.blurb, ''), 'blood\s+pressure', 'blood pressure bp', 'gi'),
      '[^a-zA-Z0-9]+', ' ', 'g'
    )), 'C') ||
    setweight(to_tsvector('english', regexp_replace(coalesce(new.cat, ''), '[^a-zA-Z0-9]+', ' ', 'g')), 'D');
  return new;
end;
$$;

-- Back-fill existing rows immediately.
update public.products set
  search_vector =
    setweight(to_tsvector('english', regexp_replace(
      regexp_replace(coalesce(name, ''), 'blood\s+pressure', 'blood pressure bp', 'gi'),
      '[^a-zA-Z0-9]+', ' ', 'g'
    )), 'A') ||
    setweight(
      to_tsvector('english', regexp_replace(
        regexp_replace(
          coalesce(brand, '') || ' ' || array_to_string(coalesce(tags, '{}'), ' '),
          'blood\s+pressure', 'blood pressure bp', 'gi'
        ),
        '[^a-zA-Z0-9]+', ' ', 'g'
      )),
      'B'
    ) ||
    setweight(to_tsvector('english', regexp_replace(
      regexp_replace(coalesce(blurb, ''), 'blood\s+pressure', 'blood pressure bp', 'gi'),
      '[^a-zA-Z0-9]+', ' ', 'g'
    )), 'C') ||
    setweight(to_tsvector('english', regexp_replace(coalesce(cat, ''), '[^a-zA-Z0-9]+', ' ', 'g')), 'D');
