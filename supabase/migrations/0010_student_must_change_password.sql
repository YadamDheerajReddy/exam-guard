-- Same pattern as admins.must_change_password: students created with a
-- generated temp password (roster upload) must change it on first login,
-- per the App Flow doc's student journey step 1. Defaults false so
-- existing students aren't retroactively locked out.
alter table students add column must_change_password boolean not null default false;
