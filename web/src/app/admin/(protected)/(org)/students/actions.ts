"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAdmin } from "@/lib/admin-context";
import { eraseOrAnonymizeStudent } from "@/lib/student-erasure";

export type ResetPasswordResult =
  | { ok: true; tempPassword: string }
  | { ok: false; error: string };

// Covers students who never got a temp password shown to them — added
// directly via the mapping builder's "existing students" pool, or created
// before this deterministic-password scheme existed. Regenerates the same
// rollNumber@organizationId password roster upload uses, so it stays
// predictable for the admin, and forces a change on next student login
// (same as a freshly-created account).
export async function resetStudentPassword(studentId: string): Promise<ResetPasswordResult> {
  const admin = await requireOrgAdmin();
  const service = createAdminClient();

  const { data: student } = await service
    .from("students")
    .select("id, roll_number")
    .eq("id", studentId)
    .eq("organization_id", admin.organizationId)
    .maybeSingle();
  if (!student) {
    return { ok: false, error: "Student not found." };
  }

  const { data: org } = await service
    .from("organizations")
    .select("slug")
    .eq("id", admin.organizationId)
    .maybeSingle();
  if (!org?.slug) {
    return { ok: false, error: "Set your organization's Organization ID first (Change Password page)." };
  }

  const tempPassword = `${student.roll_number}@${org.slug}`;
  const { error: authError } = await service.auth.admin.updateUserById(studentId, {
    password: tempPassword,
  });
  if (authError) {
    return { ok: false, error: authError.message };
  }

  await service.from("students").update({ must_change_password: true }).eq("id", studentId);

  revalidatePath("/admin/students");
  return { ok: true, tempPassword };
}

export type UpdateStudentState = { error?: string } | undefined;

export async function updateStudent(
  studentId: string,
  _prevState: UpdateStudentState,
  formData: FormData,
): Promise<UpdateStudentState> {
  const admin = await requireOrgAdmin();
  const service = createAdminClient();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const rollNumber = String(formData.get("rollNumber") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();

  if (!fullName) return { error: "Name is required." };
  if (!rollNumber) return { error: "Roll number is required." };
  if (!department) return { error: "This field is required." };

  const { data: existing } = await service
    .from("students")
    .select("id")
    .eq("organization_id", admin.organizationId)
    .eq("roll_number", rollNumber)
    .neq("id", studentId)
    .maybeSingle();
  if (existing) return { error: "Another student already has that roll number." };

  const { error } = await service
    .from("students")
    .update({ full_name: fullName, roll_number: rollNumber, department })
    .eq("id", studentId)
    .eq("organization_id", admin.organizationId);

  if (error) return { error: error.message };

  revalidatePath("/admin/students");
  return undefined;
}

export type DeleteStudentResult = { error?: string; action?: "anonymized" | "deleted" };

// For a student who isn't returning next academic year. Reuses the same
// anonymize-or-delete decision as a formal DPDP erasure request — a
// student with verification history keeps an anonymized, locked-out
// record (their scans stay part of the audit trail); one with none is
// removed outright.
export async function deleteStudent(studentId: string): Promise<DeleteStudentResult> {
  const admin = await requireOrgAdmin();
  const service = createAdminClient();

  const { data: student } = await service
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("organization_id", admin.organizationId)
    .maybeSingle();
  if (!student) return { error: "Student not found." };

  const { action } = await eraseOrAnonymizeStudent(service, studentId);

  revalidatePath("/admin/students");
  return { action };
}
