create table hall_ticket_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name varchar(100) not null,
  header_text varchar(150),
  footer_note text,
  letter text,
  show_address boolean not null default false,
  primary_color varchar(7),
  font varchar(30),
  border_style varchar(10),
  header_layout varchar(10),
  logo_size integer,
  header_bg_color varchar(7),
  header_bg_gradient_to varchar(7),
  org_name_color varchar(7),
  is_default boolean not null default false,
  created_at timestamptz default now(),
  unique (organization_id, name)
);
create index idx_hall_ticket_templates_org on hall_ticket_templates(organization_id);

alter table hall_ticket_templates enable row level security;

create policy "org_admin_manage_hall_ticket_templates"
on hall_ticket_templates for all
to authenticated
using (organization_id = private.admin_org_id())
with check (organization_id = private.admin_org_id());
