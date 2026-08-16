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
    .select("id, course_code, course_title, exam_date, start_time")
    .eq("id", examId)
    .maybeSingle();

  if (!exam) notFound();

  // Server Component: runs fresh per request, not memoized/re-rendered by
  // the React Compiler the way a Client Component would be, so "now" here
  // is exactly what we want.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const [{ data: halls }, { data: students }, { data: existingMappings }, { data: rosterUploads }] =
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
        .select("id, student_id, hall_id, seat_number, students(roll_number, full_name), halls(building_name, room_number)")
        .eq("exam_id", examId),
      supabase
        .from("roster_uploads")
        .select("id, created_at, roster_upload_students(student_id)")
        .eq("organization_id", admin.organizationId)
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
    ]);

  const mappedStudentIds = new Set((existingMappings ?? []).map((m) => m.student_id));
  const unmappedStudents = (students ?? []).filter((s) => !mappedStudentIds.has(s.id));
  const unmappedIds = new Set(unmappedStudents.map((s) => s.id));

  const usedSeatsByHall = new Map<string, number>();
  for (const m of existingMappings ?? []) {
    usedSeatsByHall.set(m.hall_id, (usedSeatsByHall.get(m.hall_id) ?? 0) + 1);
  }

  const hallsWithUsage = (halls ?? []).map((h) => ({
    id: h.id,
    buildingName: h.building_name,
    roomNumber: h.room_number,
    capacity: h.capacity,
    usedSeats: usedSeatsByHall.get(h.id) ?? 0,
  }));

  // Only keep batches that still have at least one unmapped student in
  // them — a batch fully mapped elsewhere isn't a useful filter option here.
  const rosterBatches = (rosterUploads ?? [])
    .map((u) => ({
      id: u.id,
      label: new Date(u.created_at).toLocaleString(),
      studentIds: (u.roster_upload_students ?? [])
        .map((link) => link.student_id)
        .filter((id) => unmappedIds.has(id)),
    }))
    .filter((b) => b.studentIds.length > 0);

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
          halls={hallsWithUsage}
          students={unmappedStudents.map((s) => ({
            id: s.id,
            rollNumber: s.roll_number,
            fullName: s.full_name,
            department: s.department,
          }))}
          rosterBatches={rosterBatches}
          existingMappings={(existingMappings ?? []).map((m) => {
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
