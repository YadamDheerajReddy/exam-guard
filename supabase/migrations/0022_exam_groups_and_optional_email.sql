-- Exam groups: "Mid-term Exams", "Final Exams" etc — an exam optionally
-- belongs to one, common to every org type. Purely an exams-level grouping
-- concept; nothing else references it, so no changes needed to
-- student_exam_mappings or verification_logs.
create table exam_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name varchar(150) not null,
  created_at timestamptz default now()
);
create index idx_exam_groups_org on exam_groups(organization_id);

alter table exam_groups enable row level security;

-- Mirrors exams' own single ALL policy exactly (private.admin_org_id()) —
-- students/invigilators never need direct RLS access here since every
-- student/invigilator-facing read goes through a service-role server
-- action, same as exams itself.
create policy "org_admin_manage_exam_groups"
on exam_groups for all
to authenticated
using (organization_id = private.admin_org_id())
with check (organization_id = private.admin_org_id());

alter table exams
  add column exam_group_id uuid references exam_groups(id);
create index idx_exams_group on exams(exam_group_id);

-- School students often have no email at all — roster upload for a
-- school org no longer requires one (see web/src/lib/roster.ts). NULL is
-- distinct from every other NULL under a UNIQUE constraint per the SQL
-- standard, so multiple students with no email on file is fine as-is.
alter table students alter column email drop not null;
