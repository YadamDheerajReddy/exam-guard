import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTempPassword, deleteAuthUser } from "@/lib/create-auth-account";

export type EraseStudentResult = { action: "anonymized" | "deleted"; resolutionNotes: string };

// Shared by the DPDP erasure-request flow (data-requests/actions.ts) and
// plain roster offboarding (students/actions.ts) — "a student's data needs
// to go away" has exactly one correct implementation regardless of which
// button triggered it.
//
// verification_logs is a legitimate audit trail with its own retention
// basis (exam integrity, dispute resolution) — the Act allows that to
// override an erasure request, and the same reasoning applies to a student
// who simply isn't returning next year. No logs yet -> a real, full delete
// is safe. Logs exist -> anonymize instead: every identifying field gets
// scrubbed while the structural record (which seat, which hall, which
// outcome) stays intact for that legitimate purpose.
export async function eraseOrAnonymizeStudent(
  service: ReturnType<typeof createAdminClient>,
  studentId: string,
): Promise<EraseStudentResult> {
  const { data: mappings } = await service.from("student_exam_mappings").select("id").eq("student_id", studentId);
  const mappingIds = (mappings ?? []).map((m) => m.id);
  const { count: logCount } = mappingIds.length
    ? await service.from("verification_logs").select("id", { count: "exact", head: true }).in("mapping_id", mappingIds)
    : { count: 0 };

  const { data: studentRow } = await service.from("students").select("photo_url").eq("id", studentId).maybeSingle();
  if (studentRow?.photo_url) {
    await service.storage.from("student-photos").remove([studentRow.photo_url]);
  }

  if ((logCount ?? 0) > 0) {
    const placeholder = `erased-${studentId.slice(0, 8)}`;
    await service
      .from("students")
      .update({
        full_name: "Erased Data Principal",
        email: `${placeholder}@examguard.internal`,
        roll_number: placeholder.toUpperCase(),
        photo_url: "",
        is_active: false,
      })
      .eq("id", studentId);
    // Locks the account out permanently without deleting the row — deleting
    // it would cascade away the verification records this branch exists to
    // preserve. A fresh, never-communicated password is the lock.
    await service.auth.admin.updateUserById(studentId, { password: generateTempPassword() });
    return {
      action: "anonymized",
      resolutionNotes:
        "Personal data (name, email, roll number, photo) anonymized and the account permanently disabled. Verification records retained for audit purposes.",
    };
  }

  await service.from("password_reset_tokens").delete().eq("student_id", studentId);
  await service.from("roster_upload_students").delete().eq("student_id", studentId);
  await service.from("student_exam_mappings").delete().eq("student_id", studentId);
  await service.from("students").delete().eq("id", studentId);
  await deleteAuthUser(studentId);
  return {
    action: "deleted",
    resolutionNotes: "Student record and all associated data permanently deleted — no verification history existed to retain.",
  };
}
