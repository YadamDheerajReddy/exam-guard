import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudent } from "@/lib/student-context";
import { DataRightsForm } from "./data-rights-form";
import { ShieldCheck } from "lucide-react";

export default async function StudentPrivacyPage() {
  const student = await requireStudent();
  const service = createAdminClient();

  const [{ data: studentRow }, { data: org }, { data: mappings }, { data: requests }] = await Promise.all([
    service.from("students").select("roll_number, full_name, email, department, photo_url, is_active").eq("id", student.id).maybeSingle(),
    service.from("organizations").select("name, grievance_officer_name, grievance_officer_email").eq("id", student.organizationId).maybeSingle(),
    service
      .from("student_exam_mappings")
      .select("seat_number, used_at, exams(course_code, course_title, exam_date), halls(building_name, room_number)")
      .eq("student_id", student.id),
    service
      .from("data_rights_requests")
      .select("id, request_type, status, details, resolution_notes, requested_at, resolved_at")
      .eq("student_id", student.id)
      .order("requested_at", { ascending: false }),
  ]);

  // verification_logs concerning this student are reached through their
  // mappings — a student has no direct grant on that table (matches the
  // rest of the app: it's redacted/scoped server-side, not via a client
  // table grant), so this is the one legitimate read of it in their voice.
  const mappingIds = (
    await service.from("student_exam_mappings").select("id").eq("student_id", student.id)
  ).data?.map((m) => m.id) ?? [];
  const { data: logs } = mappingIds.length
    ? await service
        .from("verification_logs")
        .select("status, verified_at, notes")
        .in("mapping_id", mappingIds)
        .order("verified_at", { ascending: false })
    : { data: [] };

  let photoUrl: string | null = null;
  if (studentRow?.photo_url) {
    const { data: signed } = await service.storage.from("student-photos").createSignedUrl(studentRow.photo_url, 300);
    photoUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
        <ShieldCheck className="size-4" strokeWidth={2} />
        Privacy
      </div>
      <h1 className="mt-1 text-xl font-bold text-ink">Your data & privacy rights</h1>
      <p className="mt-1 text-sm text-slate">
        Everything ExamGuard stores about you, and how to exercise your rights under the DPDP Act, 2023.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-charcoal">What we store about you</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            ["Full name", studentRow?.full_name],
            ["Roll number", studentRow?.roll_number],
            ["Email", studentRow?.email],
            ["Department", studentRow?.department],
            ["Account status", studentRow?.is_active ? "Active" : "Inactive"],
            ["Photo on file", photoUrl ? "Yes" : "No"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate">{label}</dt>
              <dd className="mt-0.5 text-sm text-ink">{value || "—"}</dd>
            </div>
          ))}
        </dl>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL
          <img src={photoUrl} alt="" className="mt-4 h-20 w-20 rounded-lg border border-border object-cover" />
        )}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-charcoal">Your exam records</h2>
        {!mappings || mappings.length === 0 ? (
          <p className="mt-2 text-sm text-slate">No exam mappings yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {mappings.map((m, i) => {
              const exam = Array.isArray(m.exams) ? m.exams[0] : m.exams;
              const hall = Array.isArray(m.halls) ? m.halls[0] : m.halls;
              return (
                <li key={i} className="rounded-lg bg-surface px-3 py-2 text-sm text-charcoal">
                  {exam?.course_code} · {exam?.exam_date} · {hall?.building_name} {hall?.room_number} · seat{" "}
                  {m.seat_number}
                  {m.used_at && <span className="ml-1 text-xs text-verified">· checked in {new Date(m.used_at).toLocaleString()}</span>}
                </li>
              );
            })}
          </ul>
        )}

        {logs && logs.length > 0 && (
          <>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate">Verification history</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {logs.map((log, i) => (
                <li key={i} className="text-xs text-slate">
                  {new Date(log.verified_at).toLocaleString()} · {log.status}
                  {log.notes && ` · ${log.notes}`}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {org?.grievance_officer_name && (
        <div className="mt-4 rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-charcoal">Your institution&apos;s Grievance Officer</h2>
          <p className="mt-2 text-sm text-charcoal">
            {org.grievance_officer_name} ·{" "}
            <a href={`mailto:${org.grievance_officer_email}`} className="font-semibold text-accent hover:text-accent-hover">
              {org.grievance_officer_email}
            </a>
          </p>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-charcoal">Exercise a data right</h2>
        <p className="mt-1 text-xs text-slate">
          Requests are reviewed by your institution&apos;s admin — erasure may be delayed if a record is still
          needed to resolve an active dispute.
        </p>
        <DataRightsForm hasPending={(requests ?? []).some((r) => r.status === "PENDING")} />

        {requests && requests.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
            {requests.map((r) => (
              <li key={r.id} className="rounded-lg bg-surface px-3 py-2 text-xs text-charcoal">
                <span className="font-semibold">{r.request_type}</span> · {r.status} ·{" "}
                {new Date(r.requested_at).toLocaleDateString()}
                {r.resolution_notes && <p className="mt-1 text-slate">{r.resolution_notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
