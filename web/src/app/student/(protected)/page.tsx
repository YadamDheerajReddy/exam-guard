import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudent } from "@/lib/student-context";
import { examStatus, type ExamStatus } from "@/lib/reveal";
import { CalendarClock, ChevronRight, ClipboardList } from "lucide-react";

const STATUS_LABEL: Record<ExamStatus, string> = {
  upcoming: "Upcoming",
  "pass-ready": "Pass Ready",
  completed: "Completed",
};

const STATUS_CLASS: Record<ExamStatus, string> = {
  upcoming: "bg-inactive-tint text-inactive",
  "pass-ready": "bg-verified-tint text-verified",
  completed: "bg-surface text-slate",
};

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
  const { data: mappings } = await service
    .from("student_exam_mappings")
    .select("id, exam_id, exams(course_code, course_title, exam_date, start_time, end_time, reveal_threshold_minutes)")
    .eq("student_id", student.id);

  const now = new Date();

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
        ),
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => `${a.examDate}${a.startTime}`.localeCompare(`${b.examDate}${b.startTime}`));

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="text-xl font-bold text-ink">Your exams</h1>
      <p className="mt-1 text-sm text-slate">All exams you&rsquo;re mapped to, soonest first.</p>

      <div className="mt-6 flex flex-col gap-3">
        {exams.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center">
            <ClipboardList className="mx-auto size-8 text-slate" strokeWidth={1.5} />
            <p className="mt-3 text-sm text-slate">
              No exams mapped to you yet. Check back once your institution
              publishes the schedule.
            </p>
          </div>
        ) : (
          exams.map((exam) => (
            <Link
              key={exam.examId}
              href={`/student/exams/${exam.examId}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{exam.courseCode}</p>
                <p className="truncate text-sm text-slate">{exam.courseTitle}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate">
                  <CalendarClock className="size-3.5 shrink-0" strokeWidth={2} />
                  {exam.examDate} · {exam.startTime}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_CLASS[exam.status]}`}
                >
                  {STATUS_LABEL[exam.status]}
                </span>
                <ChevronRight className="size-4 text-slate" strokeWidth={2} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
