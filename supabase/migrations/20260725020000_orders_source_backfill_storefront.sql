-- Backfills orders.source for every existing row that has it null.
--
-- orders.source was added by 20260723000000_orders_source.sql specifically
-- for admin-app's manual "Add/Edit order" flow (app/orders/page.tsx), which
-- requires it and only offers "WhatsApp"/"Friends & Family" — every manually
-- created order has always set a non-null source. Storefront checkout
-- (supabase/functions/place-order) never set it at all, so any row with
-- source IS NULL is necessarily storefront-origin, not a guess. A null
-- source also silently blocked Save in the edit modal (the "Source *"
-- dropdown had no matching option to select), so this also fixes every
-- pre-existing storefront order's edit flow, not just new ones — place-order
-- now sets source: "Storefront" going forward.
update public.orders
set source = 'Storefront'
where source is null;
