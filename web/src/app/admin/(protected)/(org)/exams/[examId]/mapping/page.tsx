import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/admin-context";
import { MappingBuilder } from "@/components/admin/mapping-builder";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function MappingPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: exam } = await supabase
    .from("exams")
    .select("id, course_code, course_title, exam_date, start_time, exam_group_id")
    .eq("id", examId)
    .maybeSingle();

  if (!exam) notFound();

  const { data: org } = await supabase
    .from("organizations")
    .select("type")
    .eq("id", admin.organizationId)
    .maybeSingle();
  const isSchool = org?.type === "SCHOOL";

  // A grouped exam's mapping page also needs every sibling exam in the
  // group — the "map the whole group at once" option below reuses one
  // hall/seat assignment across all of them, so the unmapped-student pool
  // has to account for mappings on any exam in the group, not just this one.
  let examGroup: { id: string; name: string; exams: { id: string; courseCode: string }[] } | null = null;
  let groupExamIds = [examId];
  if (exam.exam_group_id) {
    const [{ data: group }, { data: groupExams }] = await Promise.all([
      supabase.from("exam_groups").select("id, name").eq("id", exam.exam_group_id).maybeSingle(),
      supabase
        .from("exams")
        .select("id, course_code")
        .eq("exam_group_id", exam.exam_group_id)
        .order("exam_date", { ascending: true }),
    ]);
    if (group && groupExams && groupExams.length > 0) {
      examGroup = { id: group.id, name: group.name, exams: groupExams.map((e) => ({ id: e.id, courseCode: e.course_code })) };
      groupExamIds = groupExams.map((e) => e.id);
    }
  }

  // Server Component: runs fresh per request, not memoized/re-rendered by
  // the React Compiler the way a Client Component would be, so "now" here
  // is exactly what we want.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const [{ data: halls }, { data: students }, { data: groupMappings }, { data: rosterUploads }] =
    await Promise.all([
      supabase
        .from("halls")
        .select("id, building_name, room_number, capacity")
        .order("building_name", { ascending: true }),
      supabase
        .from("students")
        .select("id, roll_number, full_name, department")
        .eq("is_active", true)
        .order("roll_number", { ascending: true }),
      supabase
        .from("student_exam_mappings")
        .select(
          "id, exam_id, student_id, hall_id, seat_number, students(roll_number, full_name), halls(building_name, room_number)",
        )
        .in("exam_id", groupExamIds),
      supabase
        .from("roster_uploads")
        .select("id, created_at, roster_upload_students(student_id)")
        .eq("organization_id", admin.organizationId)
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
    ]);

  const existingMappings = (groupMappings ?? []).filter((m) => m.exam_id === examId);
  const mappedStudentIdsForExam = new Set(existingMappings.map((m) => m.student_id));

  const mappedExamIdsByStudent = new Map<string, Set<string>>();
  for (const m of groupMappings ?? []) {
    const set = mappedExamIdsByStudent.get(m.student_id) ?? new Set<string>();
    set.add(m.exam_id);
    mappedExamIdsByStudent.set(m.student_id, set);
  }

  const allStudents = students ?? [];
  const studentsForExamMode = allStudents.filter((s) => !mappedStudentIdsForExam.has(s.id));
  const studentsForGroupMode = examGroup
    ? allStudents.filter((s) => groupExamIds.some((id) => !(mappedExamIdsByStudent.get(s.id)?.has(id) ?? false)))
    : studentsForExamMode;

  const unmappedGroupIds = new Set(studentsForGroupMode.map((s) => s.id));

  const usedSeatsByHall = new Map<string, number>();
  for (const m of existingMappings) {
    usedSeatsByHall.set(m.hall_id, (usedSeatsByHall.get(m.hall_id) ?? 0) + 1);
  }

  const hallsWithUsage = (halls ?? []).map((h) => ({
    id: h.id,
    buildingName: h.building_name,
    roomNumber: h.room_number,
    capacity: h.capacity,
    usedSeats: usedSeatsByHall.get(h.id) ?? 0,
  }));

  // Only keep batches that still have at least one still-relevant student in
  // them — a batch fully mapped elsewhere isn't a useful filter option here.
  // Scoped against the broader group pool (a superset of the exam-only
  // pool) so a batch stays selectable in either mode; the mode toggle then
  // narrows which of its students are actually offered.
  const rosterBatches = (rosterUploads ?? [])
    .map((u) => ({
      id: u.id,
      label: new Date(u.created_at).toLocaleString(),
      studentIds: (u.roster_upload_students ?? [])
        .map((link) => link.student_id)
        .filter((id) => unmappedGroupIds.has(id)),
    }))
    .filter((b) => b.studentIds.length > 0);

  const shapeStudents = (list: typeof allStudents) =>
    list.map((s) => ({ id: s.id, rollNumber: s.roll_number, fullName: s.full_name, department: s.department }));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-bold text-ink">
        Map students · {exam.course_code}
      </h1>
      <p className="mt-1 text-sm text-slate">
        {exam.course_title} — {exam.exam_date} at {exam.start_time}
      </p>

      <div className="mt-6">
        <MappingBuilder
          examId={exam.id}
          isSchool={isSchool}
          examGroup={examGroup}
          halls={hallsWithUsage}
          studentsForExamMode={shapeStudents(studentsForExamMode)}
          studentsForGroupMode={shapeStudents(studentsForGroupMode)}
          rosterBatches={rosterBatches}
          existingMappings={existingMappings.map((m) => {
            const student = Array.isArray(m.students) ? m.students[0] : m.students;
            const hall = Array.isArray(m.halls) ? m.halls[0] : m.halls;
            return {
              id: m.id,
              rollNumber: student?.roll_number ?? "",
              fullName: student?.full_name ?? "",
              hallLabel: hall ? `${hall.building_name} · ${hall.room_number}` : "",
              seatNumber: m.seat_number,
            };
          })}
        />
      </div>
    </div>
  );
}
