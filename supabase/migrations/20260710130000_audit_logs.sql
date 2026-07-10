-- Admin activity / history log.
--
-- The admin panel writes directly to the database via PostgREST (anon key + RLS),
-- so there is no server layer where we could record who changed what. Instead we
-- capture every meaningful change with an AFTER trigger on the audited tables.
-- Because the trigger runs inside the same request, it can read:
--   * the actor          -> auth.uid() + public.profiles
--   * the user agent / IP -> PostgREST's per-request `request.headers` GUC
--   * the full old/new    -> to_jsonb(OLD) / to_jsonb(NEW)
-- The trigger is SECURITY DEFINER, so it (and only it) may write to audit_logs;
-- clients get read-only access gated by public.is_admin().

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  table_name     text not null,
  record_id      text,
  action         text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id       uuid,
  actor_email    text,
  actor_role     text,
  changed_fields text[],
  old_data       jsonb,
  new_data       jsonb,
  summary        text,
  user_agent     text,
  ip_address     text
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_table_record_idx on public.audit_logs (table_name, record_id);

-- ---------------------------------------------------------------------------
-- RLS: admins/staff may read; nobody may write directly (only the trigger).
-- ---------------------------------------------------------------------------
alter table public.audit_logs enable row level security;

drop policy if exists "Admins can read audit logs" on public.audit_logs;
create policy "Admins can read audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Trigger function. Pass the primary-key column name as the trigger argument,
-- e.g. EXECUTE FUNCTION public.log_audit_event('id').
-- ---------------------------------------------------------------------------
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pk_col        text := TG_ARGV[0];
  -- Columns whose change alone is not worth a log entry: `updated_at` is touched
  -- on every write, and `sales_count` is bumped by customer purchases
  -- (increment_product_sales), not by admins.
  ignore_cols   text[] := array['updated_at', 'sales_count'];
  v_old         jsonb;
  v_new         jsonb;
  v_changed     text[];
  v_record_id   text;
  v_headers     json;
  v_claims      json;
  v_ua          text;
  v_ip          text;
  v_actor_id    uuid := auth.uid();
  v_actor_email text;
  v_actor_role  text;
  v_summary     text;
  parts         text[] := array[]::text[];
  k             text;
begin
  if TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
  elsif TG_OP = 'INSERT' then
    v_new := to_jsonb(NEW);
  else
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);

    -- Which columns actually changed, ignoring the noise columns.
    select array_agg(e.key order by e.key)
      into v_changed
    from jsonb_each(v_new) e
    where e.value is distinct from (v_old -> e.key)
      and e.key <> all (ignore_cols);

    -- Nothing meaningful changed (e.g. only updated_at / sales_count) -> skip.
    if v_changed is null then
      return null;
    end if;
  end if;

  v_record_id := coalesce(v_new ->> pk_col, v_old ->> pk_col);

  -- Actor identity. Prefer the app-level role/email from profiles; fall back to
  -- the JWT email when there is no matching profile row.
  begin
    v_claims := nullif(current_setting('request.jwt.claims', true), '')::json;
    v_actor_email := v_claims ->> 'email';
  exception when others then
    v_claims := null;
  end;

  if v_actor_id is not null then
    select coalesce(p.email, v_actor_email), p.role
      into v_actor_email, v_actor_role
    from public.profiles p
    where p.id = v_actor_id;
  end if;

  -- User agent + IP from the PostgREST request headers (present for Data-API
  -- calls, i.e. all admin-panel edits; null for direct SQL / dashboard edits).
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;

  if v_headers is not null then
    v_ua := v_headers ->> 'user-agent';
    v_ip := nullif(
      btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1)),
      ''
    );
  end if;

  -- Human-readable one-line summary.
  if TG_OP = 'INSERT' then
    v_summary := 'created';
  elsif TG_OP = 'DELETE' then
    v_summary := 'deleted';
  else
    foreach k in array v_changed loop
      parts := parts || (
        k || ': ' ||
        left(coalesce(v_old ->> k, '∅'), 80) || ' → ' ||
        left(coalesce(v_new ->> k, '∅'), 80)
      );
    end loop;
    v_summary := array_to_string(parts, ', ');
  end if;

  insert into public.audit_logs (
    table_name, record_id, action, actor_id, actor_email, actor_role,
    changed_fields, old_data, new_data, summary, user_agent, ip_address
  ) values (
    TG_TABLE_NAME, v_record_id, TG_OP, v_actor_id, v_actor_email, v_actor_role,
    v_changed, v_old, v_new, v_summary, v_ua, v_ip
  );

  return null; -- AFTER trigger; return value is ignored
end;
$$;

-- The function is only ever invoked by triggers; no client should call it.
revoke execute on function public.log_audit_event() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Attach triggers.
--   * Catalog/content tables: INSERT + UPDATE + DELETE.
--   * orders: UPDATE + DELETE only — new orders are created by customers via the
--     place-order edge function and are not admin actions.
-- ---------------------------------------------------------------------------
drop trigger if exists audit_products on public.products;
create trigger audit_products
  after insert or update or delete on public.products
  for each row execute function public.log_audit_event('id');

drop trigger if exists audit_product_costs on public.product_costs;
create trigger audit_product_costs
  after insert or update or delete on public.product_costs
  for each row execute function public.log_audit_event('product_id');

drop trigger if exists audit_categories on public.categories;
create trigger audit_categories
  after insert or update or delete on public.categories
  for each row execute function public.log_audit_event('id');

drop trigger if exists audit_homepage_banners on public.homepage_banners;
create trigger audit_homepage_banners
  after insert or update or delete on public.homepage_banners
  for each row execute function public.log_audit_event('id');

drop trigger if exists audit_orders on public.orders;
create trigger audit_orders
  after update or delete on public.orders
  for each row execute function public.log_audit_event('id');
