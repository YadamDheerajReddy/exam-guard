import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/admin-context";
import { getAttendanceRollup } from "./actions";
import { AttendanceDashboard } from "@/components/admin/attendance-dashboard";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ examId?: string }>;
}) {
  const admin = await requireOrgAdmin();
  const { examId } = await searchParams;
  const supabase = await createClient();

  const { data: exams } = await supabase
    .from("exams")
    .select("id, course_code, course_title, exam_date, start_time")
    .eq("organization_id", admin.organizationId)
    .order("exam_date", { ascending: false });

  const selectedExamId = examId ?? exams?.[0]?.id ?? null;
  const rollup = selectedExamId ? await getAttendanceRollup(selectedExamId) : null;
  const selectedExam = (exams ?? []).find((e) => e.id === selectedExamId) ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-bold text-ink">Live Attendance</h1>
      <p className="mt-1 text-sm text-slate">Hall-by-hall verification counts, updating in real time.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(exams ?? []).length === 0 && <p className="text-sm text-slate">No exams yet.</p>}
        {(exams ?? []).map((exam) => (
          <Link
            key={exam.id}
            href={`/admin/attendance?examId=${exam.id}`}
            className={
              exam.id === selectedExamId
                ? "rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white"
                : "rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-semibold text-charcoal transition-colors hover:bg-surface"
            }
          >
            {exam.course_code} — {exam.course_title} · {exam.exam_date}
          </Link>
        ))}
      </div>

      {selectedExam && rollup && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-charcoal">
            {selectedExam.course_code} — {selectedExam.course_title}
          </p>
          <div className="mt-3">
            <AttendanceDashboard key={selectedExam.id} examId={selectedExam.id} initial={rollup} />
          </div>
        </div>
      )}
    </div>
  );
}
