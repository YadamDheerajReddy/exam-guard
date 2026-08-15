import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MappingBuilder } from "@/components/admin/mapping-builder";

export default async function MappingPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const supabase = await createClient();

  const { data: exam } = await supabase
    .from("exams")
    .select("id, course_code, course_title, exam_date, start_time")
    .eq("id", examId)
    .maybeSingle();

  if (!exam) notFound();

  const [{ data: halls }, { data: students }, { data: existingMappings }] = await Promise.all([
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
  ]);

  const mappedStudentIds = new Set((existingMappings ?? []).map((m) => m.student_id));
  const unmappedStudents = (students ?? []).filter((s) => !mappedStudentIds.has(s.id));

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
