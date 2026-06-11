DO $$
DECLARE
  target_category_id TEXT;
BEGIN
  SELECT id
  INTO target_category_id
  FROM public.categories
  WHERE slug = 'weight-scale'
  LIMIT 1;

  IF target_category_id IS NULL THEN
    INSERT INTO public.categories (id, name, slug, sort_order)
    VALUES ('cat-weight-scale', 'Weight Scale', 'weight-scale', 4)
    RETURNING id INTO target_category_id;
  END IF;

  UPDATE public.products
  SET
    cat = 'weight-scale',
    category_id = target_category_id
  WHERE
    cat IN ('weight-scale-digital', 'weight-scale-manual')
    OR category_id IN ('cat-weight-scale-digital', 'cat-weight-scale-manual');

  DELETE FROM public.categories
  WHERE slug IN ('weight-scale-digital', 'weight-scale-manual')
    AND id <> target_category_id;
END $$;
