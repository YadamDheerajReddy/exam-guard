import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/admin-context";

export default async function AdminDashboardPage() {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", admin.organizationId)
    .maybeSingle();

  const [hallsCount, examsCount, mappingsCount, upcomingExams] =
    await Promise.all([
      supabase.from("halls").select("id", { count: "exact", head: true }),
      supabase.from("exams").select("id", { count: "exact", head: true }),
      supabase
        .from("student_exam_mappings")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("exams")
        .select("id, course_code, course_title, exam_date, start_time")
        .order("exam_date", { ascending: true })
        .limit(5),
    ]);

  const examIds = upcomingExams.data?.map((e) => e.id) ?? [];
  const { data: mappingRows } = examIds.length
    ? await supabase
        .from("student_exam_mappings")
        .select("exam_id")
        .in("exam_id", examIds)
    : { data: [] };

  const mappedByExam = new Map<string, number>();
  for (const row of mappingRows ?? []) {
    mappedByExam.set(row.exam_id, (mappedByExam.get(row.exam_id) ?? 0) + 1);
  }

  const stats = [
    { label: "Halls configured", value: hallsCount.count ?? 0, href: "/admin/halls" },
    { label: "Exams created", value: examsCount.count ?? 0, href: "/admin/exams" },
    { label: "Students mapped", value: mappingsCount.count ?? 0, href: "/admin/exams" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Dashboard</h1>
      <p className="mt-1 text-sm text-slate">Exam-cycle overview.</p>

      {org?.slug && (
        <div className="mt-4 rounded-lg bg-accent-tint px-4 py-3 text-sm text-accent">
          Your Organization ID is <span className="font-mono font-semibold">{org.slug}</span> —
          students need this, their roll number, and their password to log in.
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-lg border border-border bg-white p-5 transition-colors hover:border-accent"
          >
            <p className="text-2xl font-bold text-ink">{stat.value}</p>
            <p className="mt-1 text-sm text-slate">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-charcoal">Upcoming exams</h2>
          <Link href="/admin/exams" className="text-sm font-semibold text-accent">
            View all
          </Link>
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-white">
          {!upcomingExams.data || upcomingExams.data.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate">
              No exams yet.{" "}
              <Link href="/admin/exams" className="font-semibold text-accent">
                Create one
              </Link>
              .
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-wide text-slate">
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">Mapped</th>
                </tr>
              </thead>
              <tbody>
                {upcomingExams.data.map((exam) => (
                  <tr key={exam.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/exams/${exam.id}/mapping`}
                        className="font-semibold text-ink hover:text-accent"
                      >
                        {exam.course_code}
                      </Link>
                      <p className="text-xs text-slate">{exam.course_title}</p>
                    </td>
                    <td className="px-4 py-3 text-charcoal">{exam.exam_date}</td>
                    <td className="px-4 py-3 font-mono text-charcoal">
                      {exam.start_time}
                    </td>
                    <td className="px-4 py-3 text-charcoal">
                      {mappedByExam.get(exam.id) ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
