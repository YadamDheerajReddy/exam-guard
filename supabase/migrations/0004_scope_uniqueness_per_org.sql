-- roll numbers and room labels are institution-specific in the real world —
-- two different colleges will absolutely reuse "CS101" or "Room 101".
-- Global uniqueness (as in the original single-tenant schema) breaks the
-- moment a second organization exists. email stays globally unique since a
-- real contact address is naturally unique regardless of institution.
alter table students drop constraint students_roll_number_key;
alter table students add constraint students_org_roll_number_key unique (organization_id, roll_number);

alter table halls drop constraint halls_building_name_room_number_key;
alter table halls add constraint halls_org_building_room_key unique (organization_id, building_name, room_number);
