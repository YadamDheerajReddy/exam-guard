-- ExamGuard core schema (Backend Schema doc, adapted for Supabase Auth)
-- Profile tables are keyed 1:1 to auth.users(id) instead of storing password_hash themselves.
-- Applied to Supabase project: examguard (ljpgflhmevmghfvcacnk)

create table halls (
  id uuid primary key default gen_random_uuid(),
  building_name varchar(100) not null,
  room_number varchar(20) not null,
  floor_level int not null,
  capacity int not null,
  created_at timestamptz default now(),
  unique(building_name, room_number)
);

create table exams (
  id uuid primary key default gen_random_uuid(),
  course_code varchar(20) not null,
  course_title varchar(150) not null,
  exam_date date not null,
  start_time time not null,
  end_time time not null,
  reveal_threshold_minutes int not null default 30,
  created_at timestamptz default now()
);
create index idx_exams_date on exams(exam_date);

create table admins (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name varchar(100) not null,
  email varchar(100) unique not null,
  role varchar(20) check (role in ('SUPER_ADMIN','EXAM_STAFF','AUDITOR')) not null default 'EXAM_STAFF',
  created_at timestamptz default now()
);

create table invigilators (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name varchar(100) not null,
  email varchar(100) unique not null,
  assigned_hall_id uuid references halls(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

create table students (
  id uuid primary key references auth.users(id) on delete cascade,
  roll_number varchar(50) unique not null,
  full_name varchar(100) not null,
  email varchar(100) unique not null,
  photo_url text not null,
  department varchar(100) not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_students_roll_number on students(roll_number);
create index idx_students_department on students(department);

create table student_exam_mappings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  exam_id uuid references exams(id) on delete cascade,
  hall_id uuid references halls(id) on delete cascade,
  seat_number varchar(20) not null,
  barcode_token varchar(255) unique not null,
  reveal_unlocked boolean not null default false,
  used_at timestamptz,
  created_at timestamptz default now(),
  unique(student_id, exam_id),
  unique(exam_id, hall_id, seat_number)
);
create index idx_mappings_exam_hall on student_exam_mappings(exam_id, hall_id);
create index idx_mappings_student on student_exam_mappings(student_id);
create index idx_mappings_barcode_token on student_exam_mappings(barcode_token);

create table verification_logs (
  id uuid primary key default gen_random_uuid(),
  mapping_id uuid references student_exam_mappings(id),
  invigilator_id uuid not null references invigilators(id),
  client_event_id uuid not null,
  verified_at timestamptz default now(),
  status varchar(20) check (status in ('VERIFIED','WRONG_HALL','FLAGGED','ABSENT')),
  notes text,
  sync_status boolean default true,
  unique(client_event_id)
);
create index idx_verification_mapping on verification_logs(mapping_id);
create index idx_verification_status on verification_logs(status);

-- updated_at maintenance for students
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_students_updated_at
before update on students
for each row execute function set_updated_at();

-- Secure by default: enable RLS everywhere now; policies are added per-feature in later phases.
-- Server-side code (Next.js server actions/route handlers) uses the service_role key and bypasses RLS.
alter table halls enable row level security;
alter table exams enable row level security;
alter table admins enable row level security;
alter table invigilators enable row level security;
alter table students enable row level security;
alter table student_exam_mappings enable row level security;
alter table verification_logs enable row level security;

-- Students may read their own profile row.
create policy students_select_self on students
  for select using (auth.uid() = id);

-- Admins may read their own profile row (used by the console to resolve role on login).
create policy admins_select_self on admins
  for select using (auth.uid() = id);

-- Invigilators may read their own profile row.
create policy invigilators_select_self on invigilators
  for select using (auth.uid() = id);
