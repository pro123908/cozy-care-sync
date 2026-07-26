-- Include product tags in full-text search. Previously search_vector was
-- built purely from name (A) / brand (B) / blurb (C) / cat (D) — tags were
-- never indexed at all, in any weight. That's a real gap: tags is where a
-- product's alternate/curated keywords actually live (e.g. hear-002's tags
-- include "Axon K-86", while its own `name` only has "Axon K 86" with a
-- space). A product whose distinguishing keyword existed only in tags, or
-- in a punctuation form that didn't happen to tokenize the same as its
-- name, would be unreachable by search — search_products' matching is
-- restricted to weights A/B only (see 20260702130000_search_products_name_
-- brand_only.sql), and tags were in neither.
--
-- Folded into weight B alongside brand rather than given its own weight —
-- tsvector only has four weight levels (A-D) and all are already spoken
-- for. This means search_products needs no changes at all: its existing
-- ts_filter('{A,B}'::"char"[]) call already covers weight B.
create or replace function public.products_search_vector_update()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(
      to_tsvector('english', coalesce(new.brand, '') || ' ' || array_to_string(coalesce(new.tags, '{}'), ' ')),
      'B'
    ) ||
    setweight(to_tsvector('english', coalesce(new.blurb, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.cat, '')), 'D');
  return new;
end;
$$;

-- Back-fill existing rows so already-stored products pick up their tags
-- immediately, rather than waiting for their next unrelated update to fire
-- the trigger.
update public.products set
  search_vector =
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(
      to_tsvector('english', coalesce(brand, '') || ' ' || array_to_string(coalesce(tags, '{}'), ' ')),
      'B'
    ) ||
    setweight(to_tsvector('english', coalesce(blurb, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(cat, '')), 'D');
