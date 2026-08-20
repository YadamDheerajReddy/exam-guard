alter table organizations add column logo_url text;

-- Private bucket, same access pattern as student-photos: all reads/writes
-- go through the service-role client in server actions, so no public
-- storage.objects policies are needed.
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', false)
on conflict (id) do nothing;
