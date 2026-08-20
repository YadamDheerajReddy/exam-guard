alter table organizations
  add column address text,
  add column contact_number varchar(30),
  add column contact_email varchar(255),
  add column hall_ticket_header_text varchar(150),
  add column hall_ticket_footer_note text,
  add column hall_ticket_primary_color varchar(7),
  add column hall_ticket_font varchar(30),
  add column hall_ticket_signature1_url text,
  add column hall_ticket_signature1_label varchar(100),
  add column hall_ticket_signature2_url text,
  add column hall_ticket_signature2_label varchar(100);

-- Private bucket, same access pattern as student-photos/org-logos: all
-- reads/writes go through the service-role client in server actions.
insert into storage.buckets (id, name, public)
values ('hall-ticket-signatures', 'hall-ticket-signatures', false)
on conflict (id) do nothing;
