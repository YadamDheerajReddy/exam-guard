-- Client-side Supabase Realtime subscription for the Live Attendance
-- Dashboard (admin browser, RLS-scoped by org_admin_read_verification_logs
-- from the previous migration) needs this table in the realtime publication
-- to receive postgres_changes events at all.
alter publication supabase_realtime add table verification_logs;
