-- Enables Supabase Realtime (postgres_changes) for the orders table, as a
-- trial to replace/augment the admin-app Orders page's 60s full-table poll
-- with instant push on insert/update/delete. Realtime still respects the
-- existing RLS select policies (is_admin() OR is_viewer()) for whichever
-- role the subscribing client authenticates as — no new access is granted
-- beyond what that role can already SELECT.
alter publication supabase_realtime add table public.orders;
