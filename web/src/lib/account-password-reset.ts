import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateResetToken,
  hashResetToken,
  RESET_TOKEN_TTL_MS,
  RESET_REQUEST_WINDOW_MS,
  RESET_REQUEST_MAX_PER_WINDOW,
} from "@/lib/password-reset";
import { accountPasswordResetEmail } from "@/lib/email-templates";
import { sendMail } from "@/lib/mailer";
import { absoluteUrl } from "@/lib/site-url";

export type AccountType = "ADMIN" | "INVIGILATOR";

// Shared by the admin and invigilator "forgot password" flows — same
// hashed-single-use-token mechanics as the student flow (lib/password-reset
// .ts), just pointed at whichever profile table the caller names. Always
// resolves without distinguishing "no such account" / "rate limited" /
// "mail failed" from a real send, so nothing here can be used to probe
// which emails have accounts.
export async function requestAccountPasswordReset(accountType: AccountType, email: string): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return;

  const service = createAdminClient();
  const table = accountType === "ADMIN" ? "admins" : "invigilators";

  let query = service.from(table).select("id, full_name, email").eq("email", trimmed);
  // Super admins are platform staff, not an institution's account to
  // self-serve reset — excluded at the lookup itself so no token can ever
  // be minted for one, regardless of what's submitted here.
  if (accountType === "ADMIN") query = query.neq("role", "SUPER_ADMIN");
  const { data: account } = await query.maybeSingle();
  if (!account) return;

  const windowStart = new Date(Date.now() - RESET_REQUEST_WINDOW_MS).toISOString();
  const { count: recentCount } = await service
    .from("account_password_reset_tokens")
    .select("id", { count: "exact", head: true })
    .eq("account_id", account.id)
    .gte("created_at", windowStart);
  if ((recentCount ?? 0) >= RESET_REQUEST_MAX_PER_WINDOW) return;

  // Burn any still-valid earlier links so only the newest email works.
  await service
    .from("account_password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("account_id", account.id)
    .is("used_at", null);

  const { rawToken, tokenHash } = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  const { error: insertError } = await service.from("account_password_reset_tokens").insert({
    account_type: accountType,
    account_id: account.id,
    account_email: account.email,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });
  if (insertError) return;

  const resetPath = accountType === "ADMIN" ? "/admin/reset-password" : "/invigilator/reset-password";
  const resetUrl = await absoluteUrl(`${resetPath}?token=${rawToken}`);
  const { subject, html } = accountPasswordResetEmail({
    fullName: account.full_name,
    resetUrl,
    expiresInMinutes: Math.round(RESET_TOKEN_TTL_MS / 60_000),
    roleLabel: accountType === "ADMIN" ? "ExamGuard admin" : "ExamGuard invigilator",
  });
  await sendMail({ to: account.email, subject, html });
}

export async function redeemAccountPasswordReset(
  token: string,
  newPassword: string,
): Promise<{ error?: string }> {
  if (!token) return { error: "This reset link is invalid or has expired. Request a new one." };
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters." };

  const service = createAdminClient();
  const tokenHash = hashResetToken(token);

  const { data: consumed, error: consumeError } = await service
    .from("account_password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("account_id, account_type")
    .maybeSingle();

  if (consumeError || !consumed) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const { error: updateError } = await service.auth.admin.updateUserById(consumed.account_id, {
    password: newPassword,
  });
  if (updateError) return { error: updateError.message };

  const table = consumed.account_type === "ADMIN" ? "admins" : "invigilators";
  await service.from(table).update({ must_change_password: false }).eq("id", consumed.account_id);

  return {};
}
