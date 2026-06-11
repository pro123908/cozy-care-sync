DO $$
DECLARE
  target_category_id TEXT;
BEGIN
  SELECT id
  INTO target_category_id
  FROM public.categories
  WHERE slug = 'orthobelts-supports'
  LIMIT 1;

  IF target_category_id IS NULL THEN
    SELECT id
    INTO target_category_id
    FROM public.categories
    WHERE slug = 'ortho-belts'
    LIMIT 1;

    IF target_category_id IS NOT NULL THEN
      UPDATE public.categories
      SET name = 'Orthobelts and Supports', slug = 'orthobelts-supports'
      WHERE id = target_category_id;
    ELSE
      INSERT INTO public.categories (id, name, slug, sort_order)
      VALUES ('cat-orthobelts-supports', 'Orthobelts and Supports', 'orthobelts-supports', 18)
      RETURNING id INTO target_category_id;
    END IF;
  ELSE
    UPDATE public.categories
    SET name = 'Orthobelts and Supports'
    WHERE id = target_category_id;
  END IF;

  UPDATE public.products
  SET
    cat = 'orthobelts-supports',
    category_id = target_category_id
  WHERE
    cat IN ('ortho-belts', 'supports')
    OR category_id IN (
      SELECT id
      FROM public.categories
      WHERE slug IN ('ortho-belts', 'supports')
         OR id IN ('cat-ortho-belts', 'cat-supports')
    );

  DELETE FROM public.categories
  WHERE
    (slug IN ('ortho-belts', 'supports') OR id IN ('cat-ortho-belts', 'cat-supports'))
    AND id <> target_category_id;
END $$;
