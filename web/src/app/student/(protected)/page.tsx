import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudent } from "@/lib/student-context";
import { examStatus } from "@/lib/reveal";
import { safeTimeZone } from "@/lib/timezone";
import { StudentDashboard } from "@/components/student/student-dashboard";

export default async function StudentTimetablePage() {
  let student;
  try {
    student = await requireStudent();
  } catch {
    redirect("/student/login");
  }

  // Service-role client, not the student's own session — mappings carry
  // hall_id/seat_number, and no RLS policy grants students direct read
  // access to that table at all (TRD §3: hall/seat withheld server-side,
  // not just UI-hidden — this fetch scopes explicitly by student_id
  // itself rather than relying on RLS to do it).
  const service = createAdminClient();
  const [{ data: mappings }, { data: org }] = await Promise.all([
    service
      .from("student_exam_mappings")
      .select("id, exam_id, exams(course_code, course_title, exam_date, start_time, end_time, reveal_threshold_minutes)")
      .eq("student_id", student.id),
    service.from("organizations").select("timezone").eq("id", student.organizationId).maybeSingle(),
  ]);

  const now = new Date();
  const timeZone = safeTimeZone(org?.timezone);

  const exams = (mappings ?? [])
    .map((m) => {
      const exam = Array.isArray(m.exams) ? m.exams[0] : m.exams;
      if (!exam) return null;
      return {
        examId: m.exam_id,
        courseCode: exam.course_code,
        courseTitle: exam.course_title,
        examDate: exam.exam_date,
        startTime: exam.start_time,
        status: examStatus(
          now,
          exam.exam_date,
          exam.start_time,
          exam.end_time,
          exam.reveal_threshold_minutes,
          timeZone,
        ),
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => `${a.examDate}${a.startTime}`.localeCompare(`${b.examDate}${b.startTime}`));

  return <StudentDashboard fullName={student.fullName} exams={exams} />;
}
