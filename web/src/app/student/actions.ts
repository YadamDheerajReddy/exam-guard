"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rollNumberToAuthEmail } from "@/lib/student-auth";
import {
  generateResetToken,
  hashResetToken,
  RESET_TOKEN_TTL_MS,
  RESET_REQUEST_WINDOW_MS,
  RESET_REQUEST_MAX_PER_WINDOW,
} from "@/lib/password-reset";
import { studentPasswordResetEmail } from "@/lib/email-templates";
import { sendMail } from "@/lib/mailer";
import { absoluteUrl } from "@/lib/site-url";

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

// Always the same message regardless of what actually happened server-side
// (no matching org, no matching student, rate-limited, mail send failed) —
// distinguishing any of those in the response would let someone probe
// which roll numbers are registered at an institution.
const RESET_REQUESTED_MESSAGE =
  "If that roll number is registered, we've emailed password reset instructions to the address on file.";

export type RequestResetState = { message: string } | undefined;

// Institution code + roll number, same two fields as the login form — an
// institution code isn't a secret (org admins hand it out for login), and
// roll numbers are routinely printed on ID cards/timetables, so neither is
// something this flow can treat as proof of identity on its own. What
// actually gates the reset is that the link only ever goes to the email
// address already on file — never one supplied here — so only someone with
// access to that real inbox can complete it.
export async function requestStudentPasswordReset(
  _prevState: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const institutionCode = String(formData.get("institutionCode") ?? "").trim().toLowerCase();
  const rollNumber = String(formData.get("rollNumber") ?? "").trim();

  if (!institutionCode || !rollNumber) {
    return { message: RESET_REQUESTED_MESSAGE };
  }

  const service = createAdminClient();

  const { data: org } = await service.from("organizations").select("id").eq("slug", institutionCode).maybeSingle();
  const student = org
    ? (
        await service
          .from("students")
          .select("id, full_name, email, is_active")
          .eq("organization_id", org.id)
          .eq("roll_number", rollNumber)
          .maybeSingle()
      ).data
    : null;

  if (!student || !student.is_active) {
    return { message: RESET_REQUESTED_MESSAGE };
  }

  // Caps outstanding requests per student in a rolling window — without
  // this, repeatedly posting a known roll number would be a free way to
  // spam that student's real inbox, since neither input above is secret.
  const windowStart = new Date(Date.now() - RESET_REQUEST_WINDOW_MS).toISOString();
  const { count: recentCount } = await service
    .from("password_reset_tokens")
    .select("id", { count: "exact", head: true })
    .eq("student_id", student.id)
    .gte("created_at", windowStart);

  if ((recentCount ?? 0) >= RESET_REQUEST_MAX_PER_WINDOW) {
    return { message: RESET_REQUESTED_MESSAGE };
  }

  // Burn any still-valid earlier links so only the newest email works —
  // keeps the number of live tokens for this student at exactly one.
  await service
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("student_id", student.id)
    .is("used_at", null);

  const { rawToken, tokenHash } = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  const { error: insertError } = await service.from("password_reset_tokens").insert({
    student_id: student.id,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });
  if (insertError) {
    return { message: RESET_REQUESTED_MESSAGE };
  }

  const resetUrl = await absoluteUrl(`/student/reset-password?token=${rawToken}`);
  const { subject, html } = studentPasswordResetEmail({
    fullName: student.full_name,
    resetUrl,
    expiresInMinutes: Math.round(RESET_TOKEN_TTL_MS / 60_000),
  });
  await sendMail({ to: student.email, subject, html });

  return { message: RESET_REQUESTED_MESSAGE };
}

export type RedeemResetState = { error: string } | undefined;

export async function redeemStudentPasswordReset(
  _prevState: RedeemResetState,
  formData: FormData,
): Promise<RedeemResetState> {
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }
  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const service = createAdminClient();
  const tokenHash = hashResetToken(token);

  // Single UPDATE, conditioned on the token being unused and unexpired, is
  // the atomic "check and consume" — two clients racing the same token can
  // never both get a row back, so a link can't be replayed even under
  // concurrent use.
  const { data: consumed, error: consumeError } = await service
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("student_id")
    .maybeSingle();

  if (consumeError || !consumed) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const { error: updateError } = await service.auth.admin.updateUserById(consumed.student_id, {
    password: newPassword,
  });
  if (updateError) {
    return { error: updateError.message };
  }

  // A self-chosen password is never the deterministic temp pattern, so
  // this always clears the forced-change flag regardless of its prior
  // value — mirrors changeStudentPassword's own unconditional clear.
  await service.from("students").update({ must_change_password: false }).eq("id", consumed.student_id);

  redirect("/student/login?reset=success");
}
