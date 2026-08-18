"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rollNumberToAuthEmail } from "@/lib/student-auth";

export type StudentLoginState = { error?: string } | undefined;

export async function studentLogin(
  _prevState: StudentLoginState,
  formData: FormData,
): Promise<StudentLoginState> {
  const institutionCode = String(formData.get("institutionCode") ?? "").trim();
  const rollNumber = String(formData.get("rollNumber") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!institutionCode || !rollNumber || !password) {
    return { error: "Enter your institution code, roll number, and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: rollNumberToAuthEmail(institutionCode, rollNumber),
    password,
  });

  if (error || !data.user) {
    return { error: "Incorrect roll number or password." };
  }

  // Students get a deterministic rollNumber@organizationId temp password
  // (roster upload, admin password reset). Rather than trust that every
  // path which sets/resets a password also remembers to flip
  // must_change_password, check it here on every login: if the password
  // just used to sign in still matches that pattern, force a change —
  // covers first login and any later login where the student (or an
  // admin reset) left them on the temp password.
  const service = createAdminClient();
  const { data: student } = await service
    .from("students")
    .select("roll_number, organization_id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (student) {
    const { data: org } = await service
      .from("organizations")
      .select("slug, is_suspended")
      .eq("id", student.organization_id)
      .maybeSingle();

    // Super Admins can hold an org out of service entirely (organizations
    // page) — block here with a clear reason rather than letting them in
    // and bouncing them from the next page with no explanation.
    if (org?.is_suspended) {
      await supabase.auth.signOut();
      return { error: "This organization has been suspended. Contact your platform administrator." };
    }

    const tempPassword = org?.slug ? `${student.roll_number}@${org.slug}` : null;
    if (tempPassword && password === tempPassword) {
      await service.from("students").update({ must_change_password: true }).eq("id", data.user.id);
    }
  }

  redirect("/student");
}

export async function studentLogout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/student/login");
}

// Institution codes are the same human-facing "Organization ID" already
// shown to admins and handed out to students for login — not a secret —
// so looking up the owning org's admin contact emails from it for the
// "Forgot password?" panel doesn't expose anything the student couldn't
// already infer from being told to use that code.
export async function getOrgAdminEmails(institutionCode: string): Promise<string[]> {
  const trimmed = institutionCode.trim().toLowerCase();
  if (!trimmed) return [];

  const service = createAdminClient();
  const { data: org } = await service.from("organizations").select("id").eq("slug", trimmed).maybeSingle();
  if (!org) return [];

  const { data: admins } = await service.from("admins").select("email").eq("organization_id", org.id);
  return (admins ?? []).map((a) => a.email);
}
