-- Allow guest product reviews while keeping one review per order/product.

ALTER TABLE public.order_reviews
ALTER COLUMN user_id DROP NOT NULL;

DROP INDEX IF EXISTS public.order_reviews_order_user_product_key;

-- Signed-in users: one review per order/product/user.
CREATE UNIQUE INDEX IF NOT EXISTS order_reviews_order_user_product_auth_key
  ON public.order_reviews (order_code, user_id, product_id)
  WHERE user_id IS NOT NULL;

-- Guest users: one review per order/product.
CREATE UNIQUE INDEX IF NOT EXISTS order_reviews_order_product_guest_key
  ON public.order_reviews (order_code, product_id)
  WHERE user_id IS NULL;
