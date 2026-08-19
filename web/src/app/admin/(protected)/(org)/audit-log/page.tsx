import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/admin-context";
import { AuditLogTable, type AuditLogRow } from "@/components/admin/audit-log-table";

const ROW_LIMIT = 500;

type SearchParams = {
  examId?: string;
  hallId?: string;
  status?: string;
  invigilatorId?: string;
  from?: string;
  to?: string;
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const admin = await requireOrgAdmin();
  const params = await searchParams;
  const supabase = await createClient();

  // verification_logs itself has no organization_id column — RLS
  // (org_admin_read_verification_logs, scoped via invigilator_id) is what
  // actually restricts this query to the admin's own org, not this filter
  // chain. Date range is a real column so it's filtered at the DB level;
  // exam/hall/status/invigilator filters apply after the join is flattened
  // below, since they live on embedded resources.
  let query = supabase
    .from("verification_logs")
    .select(
      "id, verified_at, status, notes, invigilator_id, corrects_log_id, corrected_by, invigilators(full_name), admins(full_name), mapping_id, student_exam_mappings(seat_number, exam_id, hall_id, exams(course_code), halls(building_name, room_number), students(roll_number, full_name))",
    )
    .order("verified_at", { ascending: false })
    .limit(ROW_LIMIT);

  if (params.from) query = query.gte("verified_at", params.from);
  if (params.to) query = query.lte("verified_at", params.to);

  const [{ data: rawLogs }, { data: exams }, { data: halls }, { data: invigilators }] = await Promise.all([
    query,
    supabase
      .from("exams")
      .select("id, course_code")
      .eq("organization_id", admin.organizationId)
      .order("exam_date", { ascending: false }),
    supabase.from("halls").select("id, building_name, room_number").eq("organization_id", admin.organizationId),
    supabase.from("invigilators").select("id, full_name").eq("organization_id", admin.organizationId),
  ]);

  const rows: (AuditLogRow & { examId: string | null; hallId: string | null; invigilatorId: string | null })[] = (rawLogs ?? []).map(
    (log) => {
      const mapping = Array.isArray(log.student_exam_mappings) ? log.student_exam_mappings[0] : log.student_exam_mappings;
      const exam = mapping ? (Array.isArray(mapping.exams) ? mapping.exams[0] : mapping.exams) : null;
      const hall = mapping ? (Array.isArray(mapping.halls) ? mapping.halls[0] : mapping.halls) : null;
      const student = mapping ? (Array.isArray(mapping.students) ? mapping.students[0] : mapping.students) : null;
      const invigilator = Array.isArray(log.invigilators) ? log.invigilators[0] : log.invigilators;
      const correctingAdmin = Array.isArray(log.admins) ? log.admins[0] : log.admins;

      return {
        id: log.id,
        verifiedAt: log.verified_at,
        status: log.status,
        notes: log.notes,
        correctsLogId: log.corrects_log_id,
        correctedByName: correctingAdmin?.full_name ?? null,
        supersededBy: null as string | null,
        invigilatorName: invigilator?.full_name ?? "Unknown",
        invigilatorId: log.invigilator_id,
        examId: mapping?.exam_id ?? null,
        courseCode: exam?.course_code ?? "—",
        hallId: mapping?.hall_id ?? null,
        hallLabel: hall ? `${hall.building_name} · ${hall.room_number}` : "—",
        rollNumber: student?.roll_number ?? "—",
        fullName: student?.full_name ?? "Unrecognized scan",
        seatNumber: mapping?.seat_number ?? "—",
      };
    },
  );

  // Mark the originals that a correction supersedes, so the table can show
  // both sides of the pair rather than two contradictory-looking rows.
  const correctedIds = new Map<string, string>();
  for (const row of rows) {
    if (row.correctsLogId) correctedIds.set(row.correctsLogId, row.id);
  }
  for (const row of rows) {
    row.supersededBy = correctedIds.get(row.id) ?? null;
  }

  const filtered = rows
    .filter((r) => (params.examId ? r.examId === params.examId : true))
    .filter((r) => (params.hallId ? r.hallId === params.hallId : true))
    .filter((r) => (params.status ? r.status === params.status : true))
    .filter((r) => (params.invigilatorId ? r.invigilatorId === params.invigilatorId : true));

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-bold text-ink">Audit Log</h1>
      <p className="mt-1 text-sm text-slate">
        Every verification event, append-only — corrections are new flagged entries, never edits. Most recent {ROW_LIMIT} loaded before filters.
      </p>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-charcoal">Exam</label>
          <select name="examId" defaultValue={params.examId ?? ""} className="rounded-lg border border-border px-3 py-2 text-sm text-ink">
            <option value="">All exams</option>
            {(exams ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.course_code}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-charcoal">Hall</label>
          <select name="hallId" defaultValue={params.hallId ?? ""} className="rounded-lg border border-border px-3 py-2 text-sm text-ink">
            <option value="">All halls</option>
            {(halls ?? []).map((h) => (
              <option key={h.id} value={h.id}>
                {h.building_name} · {h.room_number}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-charcoal">Status</label>
          <select name="status" defaultValue={params.status ?? ""} className="rounded-lg border border-border px-3 py-2 text-sm text-ink">
            <option value="">All statuses</option>
            <option value="VERIFIED">Verified</option>
            <option value="WRONG_HALL">Wrong Hall</option>
            <option value="FLAGGED">Flagged</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-charcoal">Invigilator</label>
          <select
            name="invigilatorId"
            defaultValue={params.invigilatorId ?? ""}
            className="rounded-lg border border-border px-3 py-2 text-sm text-ink"
          >
            <option value="">All invigilators</option>
            {(invigilators ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-charcoal">From</label>
          <input
            type="datetime-local"
            name="from"
            defaultValue={params.from ?? ""}
            className="rounded-lg border border-border px-3 py-2 text-sm text-ink"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-charcoal">To</label>
          <input
            type="datetime-local"
            name="to"
            defaultValue={params.to ?? ""}
            className="rounded-lg border border-border px-3 py-2 text-sm text-ink"
          />
        </div>
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover">
          Filter
        </button>
        <a href="/admin/audit-log" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-surface">
          Clear
        </a>
      </form>

      <div className="mt-6">
        <AuditLogTable rows={filtered} />
      </div>
    </div>
  );
}
