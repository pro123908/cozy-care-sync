-- whatsapp_message_log is written only by edge functions via the
-- service-role key (see its own migration comment) — fine for every send
-- path except one: admin-app's courier-sync route (app/api/courier/bookings
-- /route.ts) calls send-shipment-notification directly over HTTP, and if
-- that fetch itself throws (network failure, function unreachable), the
-- edge function's own code never runs and never gets a chance to log
-- anything. That's exactly how 3 real shipment notifications silently
-- vanished on 2026-07-20/21 with zero trace anywhere queryable. This RPC
-- lets admin-app's session-bound (non-service-role) client record that
-- failure itself, same pattern as log_login_event() for audit_logs.
create or replace function public.log_whatsapp_send_failure(
  p_order_code text,
  p_phone text,
  p_message_type text,
  p_error_detail text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.whatsapp_message_log (order_code, phone, message_type, status, error_detail)
  values (p_order_code, p_phone, p_message_type, 'failed', p_error_detail);
end;
$$;
