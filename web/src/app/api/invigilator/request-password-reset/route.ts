import { NextResponse } from "next/server";
import { requestAccountPasswordReset } from "@/lib/account-password-reset";

// Deliberately unauthenticated — the mobile app calls this from the login
// screen, before the invigilator has any session. Always returns the same
// generic message regardless of whether the email matched an account, was
// rate-limited, or the mail send failed, so it can't be used to probe
// which emails have accounts (mirrors the student/admin reset flows).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";

  await requestAccountPasswordReset("INVIGILATOR", email);

  return NextResponse.json({
    message: "If that email belongs to an invigilator account, we've emailed password reset instructions.",
  });
}
