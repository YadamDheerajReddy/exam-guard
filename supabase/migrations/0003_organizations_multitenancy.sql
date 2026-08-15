-- Organizations + multi-tenancy. Super Admin (ExamGuard staff, role=SUPER_ADMIN,
-- organization_id null) creates organizations and their first admin. Org admins
-- (role IN (EXAM_STAFF, AUDITOR), organization_id set) manage halls/exams/
-- students/invigilators/mappings scoped to their own org only.

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name varchar(150) not null,
  type varchar(20) check (type in ('COLLEGE','UNIVERSITY','SCHOOL','OTHER')) not null default 'OTHER',
  created_at timestamptz default now()
);

alter table admins add column organization_id uuid references organizations(id);
alter table invigilators add column organization_id uuid references organizations(id);
alter table halls add column organization_id uuid references organizations(id);
alter table exams add column organization_id uuid references organizations(id);
alter table students add column organization_id uuid references organizations(id);

-- Backfill existing rows (created before this migration) into a Default
-- Organization so none of it is orphaned; the existing SUPER_ADMIN test
-- account is left as a real platform admin (organization_id stays null).
do $$
declare
  default_org_id uuid;
begin
  insert into organizations (name, type) values ('Default Organization', 'OTHER')
  returning id into default_org_id;

  update halls set organization_id = default_org_id where organization_id is null;
  update exams set organization_id = default_org_id where organization_id is null;
  update students set organization_id = default_org_id where organization_id is null;
  update invigilators set organization_id = default_org_id where organization_id is null;
  update admins set organization_id = default_org_id where organization_id is null and role <> 'SUPER_ADMIN';
end $$;

alter table halls alter column organization_id set not null;
alter table exams alter column organization_id set not null;
alter table students alter column organization_id set not null;
alter table invigilators alter column organization_id set not null;

alter table admins add constraint admins_org_role_check
  check ((role = 'SUPER_ADMIN' and organization_id is null) or (role <> 'SUPER_ADMIN' and organization_id is not null));

create index idx_halls_org on halls(organization_id);
create index idx_exams_org on exams(organization_id);
create index idx_students_org on students(organization_id);
create index idx_invigilators_org on invigilators(organization_id);
create index idx_admins_org on admins(organization_id);

alter table organizations enable row level security;

-- Replace the flat is_admin() model with org-scoped helpers.
drop policy admins_manage_halls on halls;
drop policy admins_manage_exams on exams;
drop policy admins_manage_mappings on student_exam_mappings;
drop policy admins_select_students on students;
drop function private.is_admin();

create function private.is_super_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.admins where id = auth.uid() and role = 'SUPER_ADMIN'
  );
$$;

create function private.admin_org_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select organization_id from public.admins where id = auth.uid();
$$;

revoke execute on function private.is_super_admin() from public;
revoke execute on function private.admin_org_id() from public;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.admin_org_id() to authenticated;

create policy super_admin_manage_organizations on organizations
  for all using (private.is_super_admin()) with check (private.is_super_admin());

create policy org_admin_select_own_organization on organizations
  for select using (id = private.admin_org_id());

create policy super_admin_manage_admins on admins
  for all using (private.is_super_admin()) with check (private.is_super_admin());

create policy org_admin_manage_halls on halls
  for all using (organization_id = private.admin_org_id()) with check (organization_id = private.admin_org_id());

create policy org_admin_manage_exams on exams
  for all using (organization_id = private.admin_org_id()) with check (organization_id = private.admin_org_id());

create policy org_admin_select_students on students
  for select using (organization_id = private.admin_org_id());

create policy org_admin_manage_invigilators on invigilators
  for all using (organization_id = private.admin_org_id()) with check (organization_id = private.admin_org_id());

create policy org_admin_manage_mappings on student_exam_mappings
  for all using (
    exists (select 1 from exams e where e.id = exam_id and e.organization_id = private.admin_org_id())
  )
  with check (
    exists (select 1 from exams e where e.id = exam_id and e.organization_id = private.admin_org_id())
  );
