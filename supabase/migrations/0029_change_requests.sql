create table change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  requested_by uuid not null references admins(id),
  subject varchar(200) not null,
  details text not null,
  status varchar(20) not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  super_admin_notes text,
  reviewed_by uuid references admins(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_change_requests_org on change_requests(organization_id);
create index idx_change_requests_status on change_requests(status);

alter table change_requests enable row level security;

create policy "org_admin_select_change_requests"
on change_requests for select
to authenticated
using (organization_id = private.admin_org_id());

create policy "org_admin_insert_change_requests"
on change_requests for insert
to authenticated
with check (organization_id = private.admin_org_id());

create policy "super_admin_all_change_requests"
on change_requests for all
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());
