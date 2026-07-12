-- Powers an admin-only "Database & Storage" usage page: total DB size, the
-- largest tables (row estimate + size), storage bucket sizes, and the auth
-- user count. All of this lives outside PostgREST's normal table exposure
-- (pg_catalog/auth/storage aren't part of the public API surface), so it's
-- wrapped in a single security definer RPC gated to full admins only.
create or replace function public.admin_get_db_usage_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_db_size bigint;
  v_tables jsonb;
  v_storage jsonb;
  v_auth_users bigint;
begin
  if not public.is_full_admin() then
    raise exception 'not authorized';
  end if;

  select pg_database_size(current_database()) into v_db_size;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_tables
  from (
    select
      c.relname as table_name,
      greatest(c.reltuples, 0)::bigint as row_estimate,
      pg_total_relation_size(c.oid) as total_bytes,
      pg_relation_size(c.oid) as table_bytes
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
    order by pg_total_relation_size(c.oid) desc
    limit 30
  ) t;

  select coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb) into v_storage
  from (
    select
      bucket_id,
      count(*) as object_count,
      sum(coalesce((metadata->>'size')::bigint, 0)) as total_bytes
    from storage.objects
    group by bucket_id
    order by sum(coalesce((metadata->>'size')::bigint, 0)) desc
  ) s;

  select count(*) into v_auth_users from auth.users;

  return jsonb_build_object(
    'database_size_bytes', v_db_size,
    'tables', v_tables,
    'storage_buckets', v_storage,
    'auth_users_count', v_auth_users,
    'generated_at', now()
  );
end;
$$;

revoke execute on function public.admin_get_db_usage_stats() from public;
grant execute on function public.admin_get_db_usage_stats() to authenticated;
