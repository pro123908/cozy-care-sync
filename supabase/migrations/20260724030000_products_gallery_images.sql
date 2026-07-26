-- Products have only ever had one photo (image_url). This adds an ordered
-- list of additional images so a product can have a real gallery, while
-- image_url keeps its existing meaning (the primary/main image) unchanged
-- everywhere it's already read — no other query/column needs touching.
-- Plain text[], matching this table's existing array-column convention
-- (tags, size_options, variant_options) rather than a separate join table,
-- since these are just ordered URLs with no per-image relations needed.
alter table public.products add column gallery_images text[] not null default '{}';
