-- Exams store a plain date + time (a wall-clock time at the institution),
-- so resolving them to a real instant needs the institution's own zone.
-- Without this the app fell back to the server process's timezone — UTC on
-- Vercel — which shifted every reveal/completion by the org's UTC offset.
--
-- Defaults to Asia/Kolkata rather than UTC deliberately: existing rows were
-- created by Indian institutions entering IST wall-clock times, so UTC would
-- "correctly" preserve the very bug this migration exists to fix.
alter table organizations
  add column timezone text not null default 'Asia/Kolkata';
