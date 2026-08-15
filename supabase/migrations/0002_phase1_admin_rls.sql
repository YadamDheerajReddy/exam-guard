-- Phase 1: let admin-console users manage the tables the Admin Core features
-- need. Roster upload's account-creation step still goes through the
-- service_role key (creating auth.users rows requires the Auth Admin API,
-- which RLS can't grant), so students has no admin insert/update policy here
-- — only select, for listing/searching in the mapping builder.
--
-- is_admin() lives in a `private` schema (not exposed by PostgREST) so it
-- can't be called as a public RPC endpoint, and is hardened with an empty
-- search_path + fully qualified table reference against search_path
-- hijacking, per Supabase's own advisor guidance for SECURITY DEFINER
-- helpers referenced from RLS policies.

create schema if not exists private;

create function private.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

revoke execute on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create policy admins_manage_halls on halls
  for all using (private.is_admin()) with check (private.is_admin());

create policy admins_manage_exams on exams
  for all using (private.is_admin()) with check (private.is_admin());

create policy admins_manage_mappings on student_exam_mappings
  for all using (private.is_admin()) with check (private.is_admin());

create policy admins_select_students on students
  for select using (private.is_admin());

-- Same search_path hardening for the Phase 0 trigger function.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
