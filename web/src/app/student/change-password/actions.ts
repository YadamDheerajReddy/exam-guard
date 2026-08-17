"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStudent } from "@/lib/student-context";

export type ChangeStudentPasswordState = { error?: string } | undefined;

export async function changeStudentPassword(
  _prevState: ChangeStudentPasswordState,
  formData: FormData,
): Promise<ChangeStudentPasswordState> {
  const student = await getCurrentStudent();
  if (!student) {
    redirect("/student/login");
  }

  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return { error: updateError.message };
  }

  // Service client, but hardcoded to one column and scoped to the id from
  // the verified session above — never client-supplied — so this can't be
  // used to touch anyone else's row.
  const service = createAdminClient();
  await service.from("students").update({ must_change_password: false }).eq("id", student.id);

  redirect("/student");
}
