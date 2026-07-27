-- Schedules the meta-ads-sync edge function daily via pg_cron + pg_net,
-- authenticated with a secret stored in Supabase Vault so it never appears
-- in this file or git history — same structure as
-- 20260727000000_health_check_cron.sql. Once daily (not health-check's
-- 15-minute cadence) since this is a data sync, not a liveness probe; the
-- function itself re-fetches a trailing window of days each run to absorb
-- Meta's conversion-attribution lag, not just "yesterday".
--
-- The actual secret value is inserted by a one-off `select
-- vault.create_secret(...)` run once outside of migration history (same
-- reason it can't live in a migration file) — this file only wires the cron
-- job to look it up by name at call time, so re-running this migration is
-- safe and doesn't touch the secret itself. The matching secret is set
-- separately as the meta-ads-sync function's META_ADS_SYNC_SECRET
-- environment secret (`supabase secrets set`).
select cron.schedule(
  'meta-ads-sync',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://dkspvlpswpipltceptoa.supabase.co/functions/v1/meta-ads-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-meta-ads-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'meta_ads_sync_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
