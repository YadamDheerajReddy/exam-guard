-- Lets a Super Admin hold an organization out of service entirely — every
-- admin/student/invigilator login for that org is blocked at the app layer
-- (admin-context.ts / student-context.ts / invigilator-context.ts) while
-- this is true, without touching their individual accounts.
alter table organizations add column is_suspended boolean not null default false;
