-- Mirrors admins/students: invigilators get a deterministic temp password
-- too now, so they need the same forced-change-on-temp-password mechanism.
alter table invigilators add column must_change_password boolean not null default false;
