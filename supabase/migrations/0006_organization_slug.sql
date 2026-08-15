-- Roll numbers are only unique *within* an org, but the synthetic auth
-- email derived from a roll number was global — so the same roll number in
-- two different orgs collided on Supabase Auth's global email uniqueness.
-- A slug per org lets the synthetic email (and student login) disambiguate
-- which institution a roll number belongs to.
alter table organizations add column slug varchar(60);

-- NOTE: this migration was applied by hand-backfilling the two orgs that
-- existed at the time (see commit history). A fresh database has no rows
-- to backfill, so this file is a no-op beyond adding the column/constraint.

alter table organizations alter column slug set not null;
alter table organizations add constraint organizations_slug_key unique (slug);
