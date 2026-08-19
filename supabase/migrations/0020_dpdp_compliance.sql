-- DPDP Act, 2023 groundwork.
--
-- Each institution is its own Data Fiduciary for its own students/staff —
-- grievance_officer_name/email let it publish a contact per the Act's
-- grievance-redressal requirement, and dpdp_acknowledged_at/by records the
-- org admin's affirmation (captured once, at first login alongside setting
-- their Organization ID) that they have lawful basis/consent — including
-- parental consent for any minor Data Principal — before enrolling
-- students on the platform.
-- dpdp_acknowledged_by is deliberately a plain uuid, NOT a foreign key to
-- admins(id): admins.organization_id already references organizations(id)
-- in the other direction, and a second FK back the other way makes every
-- PostgREST query that embeds organizations(...) from an admins-scoped
-- select (getCurrentAdmin, adminLogin) ambiguous — it can't tell which of
-- the two relationships to use and fails at runtime with PGRST201,
-- breaking admin login entirely. Recording the value without declaring it
-- as a relationship avoids that while still keeping the audit information.
alter table organizations
  add column grievance_officer_name text,
  add column grievance_officer_email text,
  add column dpdp_acknowledged_at timestamptz,
  add column dpdp_acknowledged_by uuid;

-- Lets a student formally exercise the Act's access/correction/erasure
-- rights. Requests are routed to the org admin rather than self-executing
-- — an erasure mid-exam-cycle may need to wait on a legitimate retention
-- basis (dispute resolution over a verification record), which the Act
-- itself allows as an exception, so this can't be instant and automatic.
--
-- student_id is nullable with ON DELETE SET NULL, and the roll
-- number/name are denormalized onto the row, specifically so that a
-- *fulfilled erasure* request stays a meaningful compliance record even
-- after the student row it was about no longer exists — the entire point
-- of that request type is that the row may not survive it.
create table data_rights_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  student_id uuid references students(id) on delete set null,
  student_roll_number varchar(50) not null,
  student_full_name varchar(100) not null,
  request_type varchar(20) not null check (request_type in ('ACCESS','CORRECTION','ERASURE')),
  details text,
  status varchar(20) not null default 'PENDING' check (status in ('PENDING','COMPLETED','REJECTED')),
  resolution_notes text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references admins(id)
);
create index idx_data_rights_org on data_rights_requests(organization_id);
create index idx_data_rights_student on data_rights_requests(student_id);

-- Enabled with zero policies, matching password_reset_tokens — every
-- access to this table goes through a server action's service-role
-- client, scoped explicitly to the caller's own student.id or
-- admin.organizationId, not through the cookie-scoped client + RLS.
alter table data_rights_requests enable row level security;
