-- Students had no RLS path to their own organization row at all (only
-- org admins did, via private.admin_org_id()) — needed now so
-- student-context.ts can check organizations.is_suspended (0014) via a
-- cookie-scoped client instead of the service-role client.
create function private.student_org_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select organization_id from public.students where id = auth.uid();
$$;

revoke execute on function private.student_org_id() from public;
grant execute on function private.student_org_id() to authenticated;

create policy student_select_own_organization on organizations
  for select using (id = private.student_org_id());
