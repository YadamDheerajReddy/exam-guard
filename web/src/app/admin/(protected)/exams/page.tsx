import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExamForm } from "@/components/admin/exam-form";

export default async function ExamsPage() {
  const supabase = await createClient();
  const { data: exams } = await supabase
    .from("exams")
    .select("id, course_code, course_title, exam_date, start_time, end_time, reveal_threshold_minutes")
    .order("exam_date", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Exams</h1>
      <p className="mt-1 text-sm text-slate">Course, date, time, and reveal timing.</p>

      <div className="mt-6 rounded-lg border border-border bg-white p-5">
        <h2 className="text-sm font-semibold text-charcoal">Create an exam</h2>
        <ExamForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-white">
        {!exams || exams.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate">No exams yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-wide text-slate">
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Reveal</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{exam.course_code}</p>
                    <p className="text-xs text-slate">{exam.course_title}</p>
                  </td>
                  <td className="px-4 py-3 text-charcoal">{exam.exam_date}</td>
                  <td className="px-4 py-3 font-mono text-charcoal">
                    {exam.start_time}–{exam.end_time}
                  </td>
                  <td className="px-4 py-3 text-charcoal">
                    T-{exam.reveal_threshold_minutes}m
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/exams/${exam.id}/mapping`}
                      className="text-sm font-semibold text-accent hover:text-accent-hover"
                    >
                      Map students
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
