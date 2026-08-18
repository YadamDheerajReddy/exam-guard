import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInvigilator, UnauthorizedError } from "@/lib/invigilator-context";

// Mobile equivalent of web/src/app/student/change-password/actions.ts — the
// Expo app can't run a Next.js Server Action, so this is exposed as a
// Bearer-token route instead. Updates the Supabase Auth password directly
// (service-role, scoped to the verified session's own id) and clears the
// forced-change flag.
export async function POST(request: Request) {
  let invigilator;
  try {
    invigilator = await requireInvigilator(request);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : null;
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const service = createAdminClient();
  const { error: authError } = await service.auth.admin.updateUserById(invigilator.id, { password: newPassword });
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  await service.from("invigilators").update({ must_change_password: false }).eq("id", invigilator.id);

  return NextResponse.json({ ok: true });
}
