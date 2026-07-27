-- Schedules the three Leopards courier syncs (bookings, payments,
-- shipper-advice — previously all manual buttons on admin-app's /courier
-- page) every 2 hours via pg_cron + pg_net, calling admin-app's own API
-- routes directly (they already hold LEOPARDS_API_KEY/PASSWORD and do the
-- upserting; no new edge function needed). Authenticated with a shared
-- secret since these routes normally require a logged-in staff/admin
-- session — see requireStaffOrAdminOrCourierSyncSecret in admin-app's
-- lib/supabase/requireAdmin.ts. The secret is set separately as
-- COURIER_SYNC_SECRET in admin-app's Vercel env and inserted here via a
-- one-off `select vault.create_secret(...)` outside migration history.
--
-- Payments reads from courier_bookings for its date range rather than
-- calling Leopards' booking list itself, so it must run after bookings has
-- had a chance to sync that same window — staggered 5 minutes apart rather
-- than fired in the same instant (pg_net's http calls are fire-and-forget/
-- async, so there's no way to make one wait on the other's completion
-- within a single cron tick). Shipper-advice has no such dependency (fixed
-- 90-day lookback, independent of the bookings sync), given its own slot
-- mostly just to avoid three simultaneous outbound calls.
--
-- range=7d on bookings/payments is deliberately narrower than the page's
-- own 30d default — this runs every 2 hours, so a week's window is plenty
-- to catch status changes soon after they happen; the admin's manual
-- refresh with a wider range remains the way to catch up on anything older.
create extension if not exists pg_cron;

select cron.schedule(
  'wellcaremart-courier-sync-bookings',
  '0 */2 * * *',
  $$
  select net.http_get(
    url := 'https://admin.wellcaremart.pk/api/courier/bookings?range=7d',
    headers := jsonb_build_object(
      'x-courier-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'courier_sync_secret')
    )
  );
  $$
);

select cron.schedule(
  'wellcaremart-courier-sync-payments',
  '5 */2 * * *',
  $$
  select net.http_get(
    url := 'https://admin.wellcaremart.pk/api/courier/payments?range=7d',
    headers := jsonb_build_object(
      'x-courier-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'courier_sync_secret')
    )
  );
  $$
);

select cron.schedule(
  'wellcaremart-courier-sync-shipper-advice',
  '10 */2 * * *',
  $$
  select net.http_get(
    url := 'https://admin.wellcaremart.pk/api/courier/shipper-advice',
    headers := jsonb_build_object(
      'x-courier-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'courier_sync_secret')
    )
  );
  $$
);
