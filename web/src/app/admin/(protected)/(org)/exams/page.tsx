import { createClient } from "@/lib/supabase/server";
import { ExamForm } from "@/components/admin/exam-form";
import { ExamsManager } from "@/components/admin/exams-manager";
import { requireOrgAdmin } from "@/lib/admin-context";
import { safeTimeZone } from "@/lib/timezone";
import { examStatus } from "@/lib/reveal";

export default async function ExamsPage() {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();
  const [{ data: exams }, { data: org }] = await Promise.all([
    supabase
      .from("exams")
      .select("id, course_code, course_title, exam_date, start_time, end_time, reveal_threshold_minutes")
      .order("exam_date", { ascending: true }),
    supabase.from("organizations").select("timezone").eq("id", admin.organizationId).maybeSingle(),
  ]);

  const timeZone = safeTimeZone(org?.timezone);
  const now = new Date();

  const examIds = (exams ?? []).map((e) => e.id);
  const { data: mappingRows } = examIds.length
    ? await supabase.from("student_exam_mappings").select("exam_id").in("exam_id", examIds)
    : { data: [] };

  const mappedByExam = new Map<string, number>();
  for (const row of mappingRows ?? []) {
    mappedByExam.set(row.exam_id, (mappedByExam.get(row.exam_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Exams</h1>
      <p className="mt-1 text-sm text-slate">Course, date, time, and reveal timing.</p>

      <div className="mt-6 rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-charcoal">Create an exam</h2>
        <ExamForm timeZone={timeZone} />
      </div>

      <div className="mt-6">
        <ExamsManager
          timeZone={timeZone}
          exams={(exams ?? []).map((exam) => ({
            id: exam.id,
            courseCode: exam.course_code,
            courseTitle: exam.course_title,
            examDate: exam.exam_date,
            startTime: exam.start_time,
            endTime: exam.end_time,
            revealThresholdMinutes: exam.reveal_threshold_minutes,
            mapped: mappedByExam.get(exam.id) ?? 0,
            status: examStatus(
              now,
              exam.exam_date,
              exam.start_time,
              exam.end_time,
              exam.reveal_threshold_minutes,
              timeZone,
            ),
          }))}
        />
      </div>
    </div>
  );
}
