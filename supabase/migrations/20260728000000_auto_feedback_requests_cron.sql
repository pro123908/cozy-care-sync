-- Schedules the auto-feedback-requests edge function daily at 11:00 PKT
-- (06:00 UTC — business hours, more likely to actually be read/acted on
-- than a 3am send) via pg_cron + pg_net, same secret-in-Vault pattern as
-- wellcaremart-health-check. The matching secret is set separately as the
-- function's AUTO_FEEDBACK_REQUESTS_SECRET environment secret and inserted
-- via a one-off `select vault.create_secret(...)` run outside migration
-- history (never in a migration file / git).
create extension if not exists pg_cron;

select cron.schedule(
  'wellcaremart-auto-feedback-requests',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://dkspvlpswpipltceptoa.supabase.co/functions/v1/auto-feedback-requests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auto-feedback-requests-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'auto_feedback_requests_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
