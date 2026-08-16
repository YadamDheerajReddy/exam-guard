-- Tracks each "Upload" click as a batch (whether it created new students,
-- attached existing ones, or both) so the Roster Upload page can show a
-- 30-day history without needing to store anything sensitive — temp
-- passwords are the deterministic rollNumber@organizationId formula, so
-- they're recomputed for display, never persisted.
create table roster_uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid not null references admins(id),
  created_at timestamptz not null default now()
);

create table roster_upload_students (
  roster_upload_id uuid not null references roster_uploads(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  primary key (roster_upload_id, student_id)
);

create index idx_roster_uploads_org_created on roster_uploads(organization_id, created_at);
create index idx_roster_upload_students_student on roster_upload_students(student_id);

alter table roster_uploads enable row level security;
alter table roster_upload_students enable row level security;

create policy org_admin_manage_roster_uploads on roster_uploads
  for all using (organization_id = private.admin_org_id())
  with check (organization_id = private.admin_org_id());

create policy org_admin_manage_roster_upload_students on roster_upload_students
  for all using (
    exists (
      select 1 from roster_uploads ru
      where ru.id = roster_upload_id and ru.organization_id = private.admin_org_id()
    )
  )
  with check (
    exists (
      select 1 from roster_uploads ru
      join students s on s.id = student_id
      where ru.id = roster_upload_id
        and ru.organization_id = private.admin_org_id()
        and s.organization_id = private.admin_org_id()
    )
  );
