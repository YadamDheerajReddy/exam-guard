"use server";

import { redeemAccountPasswordReset } from "@/lib/account-password-reset";

export type RedeemInvigilatorResetState = { error?: string; ok?: true } | undefined;

// Redemption happens on this web page rather than in the mobile app —
// the app has no in-app deep-link handling to catch the emailed link, but
// any phone can open it in a browser. Unlike the admin/student flows this
// doesn't redirect anywhere afterward; there's no web session to land in,
// just a message to go back and sign in with the new password.
export async function redeemInvigilatorPasswordReset(
  _prevState: RedeemInvigilatorResetState,
  formData: FormData,
): Promise<RedeemInvigilatorResetState> {
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const result = await redeemAccountPasswordReset(token, newPassword);
  if (result.error) return { error: result.error };

  return { ok: true };
}
