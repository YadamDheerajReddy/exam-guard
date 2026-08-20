import { createClient } from "@/lib/supabase/server";
import { ExamForm } from "@/components/admin/exam-form";
import { ExamGroupForm } from "@/components/admin/exam-group-form";
import { ExamsManager } from "@/components/admin/exams-manager";
import { requireOrgAdmin } from "@/lib/admin-context";
import { safeTimeZone } from "@/lib/timezone";
import { examStatus } from "@/lib/reveal";

export default async function ExamsPage() {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();
  const [{ data: exams }, { data: org }, { data: examGroups }] = await Promise.all([
    supabase
      .from("exams")
      .select(
        "id, course_code, course_title, exam_date, start_time, end_time, reveal_threshold_minutes, exam_group_id",
      )
      .order("exam_date", { ascending: true }),
    supabase.from("organizations").select("timezone, type").eq("id", admin.organizationId).maybeSingle(),
    supabase.from("exam_groups").select("id, name").order("name", { ascending: true }),
  ]);

  const timeZone = safeTimeZone(org?.timezone);
  const isSchool = org?.type === "SCHOOL";
  const now = new Date();

  const examIds = (exams ?? []).map((e) => e.id);
  const { data: mappingRows } = examIds.length
    ? await supabase.from("student_exam_mappings").select("exam_id").in("exam_id", examIds)
    : { data: [] };

  const mappedByExam = new Map<string, number>();
  for (const row of mappingRows ?? []) {
    mappedByExam.set(row.exam_id, (mappedByExam.get(row.exam_id) ?? 0) + 1);
  }

  const groups = examGroups ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Exams</h1>
      <p className="mt-1 text-sm text-slate">Course, date, time, and reveal timing.</p>

      <div className="mt-6 rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-charcoal">Exam groups</h2>
        <p className="mt-0.5 text-xs text-slate">
          Group related exams (e.g. &ldquo;Mid-term Exams&rdquo;) so you can create exams under a common label.
        </p>
        <div className="mt-3">
          <ExamGroupForm />
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-charcoal">Create an exam</h2>
        <ExamForm timeZone={timeZone} examGroups={groups} />
      </div>

      <div className="mt-6">
        <ExamsManager
          timeZone={timeZone}
          examGroups={groups}
          isSchool={isSchool}
          exams={(exams ?? []).map((exam) => ({
            id: exam.id,
            courseCode: exam.course_code,
            courseTitle: exam.course_title,
            examDate: exam.exam_date,
            startTime: exam.start_time,
            endTime: exam.end_time,
            revealThresholdMinutes: exam.reveal_threshold_minutes,
            mapped: mappedByExam.get(exam.id) ?? 0,
            examGroupId: exam.exam_group_id,
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
