alter table organizations
  add column hall_ticket_show_address boolean not null default false,
  add column hall_ticket_letter text,
  add column hall_ticket_border_style varchar(10),
  add column hall_ticket_header_layout varchar(10);
