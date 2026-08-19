import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/admin-context";
import { OrgDashboard } from "@/components/admin/org-dashboard";
import { examStatus } from "@/lib/reveal";
import { safeTimeZone } from "@/lib/timezone";

export default async function AdminDashboardPage() {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("name, slug, timezone")
    .eq("id", admin.organizationId)
    .maybeSingle();

  const timeZone = safeTimeZone(org?.timezone);
  // "Today" has to mean today *at the institution* — a UTC date rolls over
  // at 05:30 IST, which would drop the current day's exams off the board
  // for anyone working late.
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());

  const [hallRows, examsCount, mappingsCount, invigilatorsCount, upcomingExams, photoRows] = await Promise.all([
    supabase.from("halls").select("capacity"),
    supabase.from("exams").select("id", { count: "exact", head: true }),
    supabase.from("student_exam_mappings").select("id", { count: "exact", head: true }),
    supabase.from("invigilators").select("id", { count: "exact", head: true }),
    supabase
      .from("exams")
      .select("id, course_code, course_title, exam_date, start_time, end_time, reveal_threshold_minutes")
      .gte("exam_date", todayIso)
      .order("exam_date", { ascending: true })
      .limit(8),
    // Counted in JS rather than a PostgREST .or() — photo_url is NOT NULL
    // but roster upload writes "" when a CSV omits it, and filtering on an
    // empty string through the query string is easy to get subtly wrong.
    supabase.from("students").select("photo_url").eq("is_active", true),
  ]);

  const examIds = upcomingExams.data?.map((e) => e.id) ?? [];
  const { data: mappingRows } = examIds.length
    ? await supabase.from("student_exam_mappings").select("exam_id").in("exam_id", examIds)
    : { data: [] };

  const mappedByExam = new Map<string, number>();
  for (const row of mappingRows ?? []) {
    mappedByExam.set(row.exam_id, (mappedByExam.get(row.exam_id) ?? 0) + 1);
  }

  const seatsCapacity = (hallRows.data ?? []).reduce((sum, h) => sum + h.capacity, 0);
  const missingPhotos = (photoRows.data ?? []).filter((s) => !s.photo_url?.trim()).length;
  const now = new Date();

  return (
    <OrgDashboard
      orgName={org?.name ?? "ExamGuard Admin"}
      orgSlug={org?.slug ?? null}
      missingPhotos={missingPhotos}
      totals={{
        halls: hallRows.data?.length ?? 0,
        exams: examsCount.count ?? 0,
        seatsMapped: mappingsCount.count ?? 0,
        seatsCapacity,
        invigilators: invigilatorsCount.count ?? 0,
      }}
      upcomingExams={(upcomingExams.data ?? []).map((exam) => ({
        id: exam.id,
        courseCode: exam.course_code,
        courseTitle: exam.course_title,
        examDate: exam.exam_date,
        startTime: exam.start_time,
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
  );
}
