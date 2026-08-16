-- Org admins created by a Super Admin get a generated temp password shown
-- once; this flag forces them through a password change before they can
-- reach the dashboard. Defaults false so existing admins (created before
-- this migration, or bootstrapped directly) aren't suddenly locked out.
alter table admins add column must_change_password boolean not null default false;
