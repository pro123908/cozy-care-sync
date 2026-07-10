CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_order_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://dkspvlpswpipltceptoa.supabase.co/functions/v1/order-delivered-email',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'orders',
      'record', to_jsonb(NEW),
      'old_record', to_jsonb(OLD)
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_delivered_email
AFTER UPDATE ON public.orders
FOR EACH ROW
WHEN (NEW.status = 'Delivered' AND OLD.status IS DISTINCT FROM 'Delivered')
EXECUTE FUNCTION public.notify_order_delivered();
