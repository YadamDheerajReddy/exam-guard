import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/admin-context";
import { RosterUploader } from "@/components/admin/roster-uploader";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function RosterPage() {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", admin.organizationId)
    .maybeSingle();

  // Server Component: runs fresh per request, not memoized/re-rendered by
  // the React Compiler the way a Client Component would be, so "now" here
  // is exactly what we want.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
  const { data: uploads } = await supabase
    .from("roster_uploads")
    .select("id, created_at")
    .eq("organization_id", admin.organizationId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const uploadIds = (uploads ?? []).map((u) => u.id);
  const { data: links } = uploadIds.length
    ? await supabase
        .from("roster_upload_students")
        .select("roster_upload_id, students(roll_number, full_name)")
        .in("roster_upload_id", uploadIds)
    : { data: [] };

  const studentsByUpload = new Map<
    string,
    { rollNumber: string; fullName: string; tempPassword: string }[]
  >();
  for (const link of links ?? []) {
    const student = Array.isArray(link.students) ? link.students[0] : link.students;
    if (!student) continue;
    const list = studentsByUpload.get(link.roster_upload_id) ?? [];
    list.push({
      rollNumber: student.roll_number,
      fullName: student.full_name,
      tempPassword: org?.slug ? `${student.roll_number}@${org.slug}` : "",
    });
    studentsByUpload.set(link.roster_upload_id, list);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Roster Upload</h1>
      <p className="mt-1 text-sm text-slate">
        Each valid row creates a student login (roll number + a generated
        password) and a profile record.
      </p>

      <div className="mt-6">
        <RosterUploader />
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-charcoal">
          Recent uploads (last 30 days)
        </h2>
        <p className="mt-1 text-sm text-slate">
          Students you&rsquo;ve ever added stay on the{" "}
          <a href="/admin/students" className="font-semibold text-accent">
            Students page
          </a>{" "}
          permanently — this list is just a recent-activity log.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {!uploads || uploads.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-white p-6 text-center text-sm text-slate">
              No uploads in the last 30 days.
            </p>
          ) : (
            uploads.map((upload) => {
              const students = studentsByUpload.get(upload.id) ?? [];
              return (
                <details
                  key={upload.id}
                  className="rounded-lg border border-border bg-white px-4 py-3"
                >
                  <summary className="cursor-pointer text-sm text-charcoal">
                    {new Date(upload.created_at).toLocaleString()} ·{" "}
                    {students.length} student{students.length === 1 ? "" : "s"}
                  </summary>
                  <table className="mt-3 w-full text-sm">
                    <tbody>
                      {students.map((s) => (
                        <tr key={s.rollNumber} className="border-b border-border last:border-0">
                          <td className="py-1.5 font-mono text-charcoal">{s.rollNumber}</td>
                          <td className="py-1.5 text-charcoal">{s.fullName}</td>
                          <td className="py-1.5 font-mono text-slate">{s.tempPassword}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
