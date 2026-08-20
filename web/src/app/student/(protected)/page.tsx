import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudent } from "@/lib/student-context";
import { examStatus, type ExamStatus } from "@/lib/reveal";
import { safeTimeZone } from "@/lib/timezone";
import { StudentDashboard, type StudentScheduleItem } from "@/components/student/student-dashboard";

// A group's overall status: pass-ready outranks upcoming (there's something
// actionable now), and the group only reads as completed once every exam in
// it has finished — one leftover upcoming exam keeps the whole group active.
function groupStatus(statuses: ExamStatus[]): ExamStatus {
  if (statuses.every((s) => s === "completed")) return "completed";
  if (statuses.some((s) => s === "pass-ready")) return "pass-ready";
  return "upcoming";
}

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
      .select(
        "id, exam_id, exams(course_code, course_title, exam_date, start_time, end_time, reveal_threshold_minutes, exam_group_id, exam_groups(id, name))",
      )
      .eq("student_id", student.id),
    service.from("organizations").select("timezone, type").eq("id", student.organizationId).maybeSingle(),
  ]);

  const now = new Date();
  const timeZone = safeTimeZone(org?.timezone);
  const isSchool = org?.type === "SCHOOL";

  const perExam = (mappings ?? [])
    .map((m) => {
      const exam = Array.isArray(m.exams) ? m.exams[0] : m.exams;
      if (!exam) return null;
      const group = exam.exam_group_id
        ? Array.isArray(exam.exam_groups)
          ? exam.exam_groups[0]
          : exam.exam_groups
        : null;
      return {
        examId: m.exam_id,
        courseCode: exam.course_code,
        courseTitle: exam.course_title,
        examDate: exam.exam_date,
        startTime: exam.start_time,
        groupId: group?.id ?? null,
        groupName: group?.name ?? null,
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
    .filter((e): e is NonNullable<typeof e> => e !== null);

  let items: StudentScheduleItem[];
  if (isSchool) {
    // Grouped exams collapse into one dashboard entry per group, named for
    // the group — the whole point being a student sees "Mid-term Exams"
    // once instead of every paper in it separately. Non-school orgs, and
    // ungrouped exams even at school orgs, keep today's one-row-per-exam
    // behavior.
    const byGroup = new Map<string, typeof perExam>();
    const standalone: typeof perExam = [];
    for (const e of perExam) {
      if (e.groupId) {
        const list = byGroup.get(e.groupId) ?? [];
        list.push(e);
        byGroup.set(e.groupId, list);
      } else {
        standalone.push(e);
      }
    }

    const groupItems: StudentScheduleItem[] = Array.from(byGroup.values()).map((exams) => {
      const sorted = [...exams].sort((a, b) => `${a.examDate}${a.startTime}`.localeCompare(`${b.examDate}${b.startTime}`));
      const first = sorted[0];
      return {
        kind: "group",
        groupId: first.groupId!,
        groupName: first.groupName!,
        examCount: sorted.length,
        examDate: first.examDate,
        startTime: first.startTime,
        status: groupStatus(sorted.map((e) => e.status)),
      };
    });

    const standaloneItems: StudentScheduleItem[] = standalone.map((e) => ({
      kind: "exam",
      examId: e.examId,
      courseCode: e.courseCode,
      courseTitle: e.courseTitle,
      examDate: e.examDate,
      startTime: e.startTime,
      status: e.status,
    }));

    items = [...groupItems, ...standaloneItems];
  } else {
    items = perExam.map((e) => ({
      kind: "exam",
      examId: e.examId,
      courseCode: e.courseCode,
      courseTitle: e.courseTitle,
      examDate: e.examDate,
      startTime: e.startTime,
      status: e.status,
    }));
  }

  items.sort((a, b) => `${a.examDate}${a.startTime}`.localeCompare(`${b.examDate}${b.startTime}`));

  return <StudentDashboard fullName={student.fullName} exams={items} />;
}
