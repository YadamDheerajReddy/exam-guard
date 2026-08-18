-- Invigilators had no RLS path to their assigned hall's own row (only
-- org admins did) — needed so the mobile app can show "which hall am I
-- assigned to" right after login via a direct embedded select, the same
-- way admins/students already read their own scoped rows.
create function private.invigilator_hall_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select assigned_hall_id from public.invigilators where id = auth.uid();
$$;

revoke execute on function private.invigilator_hall_id() from public;
grant execute on function private.invigilator_hall_id() to authenticated;

create policy invigilator_select_assigned_hall on halls
  for select using (id = private.invigilator_hall_id());
