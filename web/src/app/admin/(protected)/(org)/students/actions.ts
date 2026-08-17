"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAdmin } from "@/lib/admin-context";

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
