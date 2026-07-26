-- Schedules the health-check edge function (checks wellcaremart.pk actually
-- renders for bots, sitemap.xml is valid, admin panel is reachable) every
-- 15 minutes via pg_cron + pg_net, authenticated with a secret stored in
-- Supabase Vault so it never appears in this file or git history. The
-- matching secret is set separately as the health-check function's
-- HEALTH_CHECK_SECRET environment secret (`supabase secrets set`).
--
-- The actual secret value is inserted by a one-off `select
-- vault.create_secret(...)` run once outside of migration history (same
-- reason it can't live in a migration file) — this file only wires the cron
-- job to look it up by name at call time, so re-running this migration is
-- safe and doesn't touch the secret itself.
create extension if not exists pg_cron;

select cron.schedule(
  'wellcaremart-health-check',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://dkspvlpswpipltceptoa.supabase.co/functions/v1/health-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-health-check-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'health_check_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
