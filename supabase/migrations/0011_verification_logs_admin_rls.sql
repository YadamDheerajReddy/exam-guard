-- verification_logs has had RLS enabled since Phase 0 but no policies —
-- meaning it was unreadable by anyone except the service-role client.
-- Phase 4's Live Attendance Dashboard and Audit Log need org admins to
-- read their own org's rows directly (both for the initial fetch and so
-- a client-side Supabase Realtime subscription — which is itself
-- RLS-scoped — actually receives change events).
--
-- Scoped via invigilator_id (NOT NULL on every row) rather than mapping_id
-- (nullable, e.g. an unrecognized/garbage scan has no resolvable mapping)
-- so every row an org's own invigilators produced is visible, including
-- the ones that didn't resolve to a real mapping.
create policy "org_admin_read_verification_logs"
on verification_logs for select
to authenticated
using (
  private.is_super_admin()
  or exists (
    select 1 from invigilators i
    where i.id = verification_logs.invigilator_id
      and i.organization_id = private.admin_org_id()
  )
);
