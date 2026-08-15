import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

// Creates the Supabase Auth identity half of a "new login" flow (roster
// upload, org-admin creation, invigilator creation all need this). The
// caller still has to insert the corresponding profile row themselves and
// call deleteAuthUser() to roll back if that insert fails.
export async function createAuthUser(email: string) {
  const admin = createAdminClient();
  const tempPassword = generateTempPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (error || !data.user) {
    return { ok: false as const, error: error?.message ?? "Could not create account." };
  }
  return { ok: true as const, userId: data.user.id, tempPassword };
}

export async function deleteAuthUser(userId: string) {
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(userId);
}
