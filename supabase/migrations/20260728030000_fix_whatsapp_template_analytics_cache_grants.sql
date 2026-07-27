-- whatsapp_template_analytics_cache (20260723120000) enables RLS with zero
-- policies, intending it to be reachable only via the edge function's
-- service-role client (which bypasses RLS entirely) — but never revoked the
-- project's default table privileges, so anon/authenticated ended up with
-- full INSERT/UPDATE/DELETE/TRUNCATE grants. RLS blocks the DML in
-- practice (no policy = denied), but TRUNCATE isn't governed by row-level
-- policies at all, leaving anon/authenticated able to wipe the table.
-- Found and fixed live 2026-07-28 while auditing meta_ads_cache's grants
-- for the same issue; this migration just records that fix in history.
revoke all on public.whatsapp_template_analytics_cache from anon, authenticated;
