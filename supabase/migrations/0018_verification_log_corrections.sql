-- verification_logs is append-only by design (Backend Schema doc: corrections
-- are new rows referencing the original, never updates/deletes) — but there
-- was no column to actually express that link, so a correction couldn't be
-- recorded at all. These two add it:
--   corrects_log_id — the scan this row supersedes
--   corrected_by    — the admin who issued it (invigilator_id stays pointing
--                     at whoever produced the original scan, so the trail
--                     still shows who was at the door)
alter table verification_logs
  add column corrects_log_id uuid references verification_logs(id),
  add column corrected_by uuid references admins(id);

create index idx_verification_corrects on verification_logs(corrects_log_id);

-- Org admins could read their org's logs but never write. This grants
-- exactly one kind of write: a correction, attributed to themselves,
-- against a scan produced by one of their own invigilators. The
-- corrects_log_id NOT NULL check is what stops an admin from forging a
-- plain scan record through this policy.
create policy "org_admin_insert_correction"
on verification_logs for insert
to authenticated
with check (
  verification_logs.corrects_log_id is not null
  and verification_logs.corrected_by = auth.uid()
  and exists (
    select 1 from invigilators i
    where i.id = verification_logs.invigilator_id
      and i.organization_id = private.admin_org_id()
  )
);
