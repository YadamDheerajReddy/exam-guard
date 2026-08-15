-- The previous policy only checked exam_id's org — hall_id and student_id
-- could still point at a different organization's rows. RLS is the actual
-- security boundary here (server actions are untrusted entry points), so
-- tighten it rather than relying solely on the UI only ever offering the
-- caller's own org's halls/students.
drop policy org_admin_manage_mappings on student_exam_mappings;

create policy org_admin_manage_mappings on student_exam_mappings
  for all using (
    exists (select 1 from exams e where e.id = exam_id and e.organization_id = private.admin_org_id())
  )
  with check (
    exists (
      select 1 from exams e
      join halls h on h.organization_id = e.organization_id
      join students s on s.organization_id = e.organization_id
      where e.id = exam_id
        and h.id = hall_id
        and s.id = student_id
        and e.organization_id = private.admin_org_id()
    )
  );
