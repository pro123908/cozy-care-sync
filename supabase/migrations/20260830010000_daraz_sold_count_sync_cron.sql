-- Nightly sync of products.daraz_delivered_sales_count from Daraz's own
-- order history, via admin-app's /api/daraz/sync-sold-count (see
-- 20260830000000_products_daraz_delivered_sales_count.sql for the column
-- and app/api/daraz/sync-sold-count/route.ts in the admin-app repo for the
-- sync logic). Scheduled one minute after the existing storefront
-- sales-count recalc so the two "sold" numbers the storefront adds together
-- refresh around the same time each night, same cron+pg_net+shared-secret
-- pattern as wellcaremart-courier-sync-* (20260728010000_courier_sync_cron.sql).
create extension if not exists pg_cron;

select cron.schedule(
  'wellcaremart-daraz-sold-count-sync',
  '32 20 * * *', -- 20:32 UTC = 01:32 PKT
  $$
  select net.http_get(
    url := 'https://admin.wellcaremart.pk/api/daraz/sync-sold-count',
    headers := jsonb_build_object(
      'x-daraz-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'daraz_sync_secret')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
