-- Private bucket for student photos. All access goes through server
-- actions using the service-role client (upload + signed URL generation),
-- so no public storage.objects policies are needed — RLS stays enabled
-- with no grants, deny-by-default like every other sensitive table here.
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', false)
on conflict (id) do nothing;

-- The org admin now picks their own Organization ID on first login instead
-- of the Super Admin auto-generating one at creation time, so a
-- newly-created organization has no slug until that happens.
alter table organizations alter column slug drop not null;
