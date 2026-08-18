import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInvigilator, UnauthorizedError } from "@/lib/invigilator-context";
import { invigilatorTempPassword } from "@/lib/student-auth";

// Mirrors the student login self-healing check (web/src/app/student/actions.ts):
// rather than trust a must_change_password flag alone — a creation/reset
// path could forget to set it — the app re-derives the expected temp
// password ({organizationName}@#{organizationId}) and forces a change
// whenever the password just used to sign in still matches it, regardless
// of whether this is the invigilator's first login. The mobile app calls
// this once, right after supabase.auth.signInWithPassword() succeeds.
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
  const password = typeof body?.password === "string" ? body.password : null;
  if (!password) {
    return NextResponse.json({ error: "password is required." }, { status: 400 });
  }

  const service = createAdminClient();
  const { data: org } = await service
    .from("organizations")
    .select("name, slug")
    .eq("id", invigilator.organizationId)
    .maybeSingle();

  const tempPassword = org?.slug ? invigilatorTempPassword(org.name, org.slug) : null;
  let mustChangePassword = invigilator.mustChangePassword;
  if (tempPassword && password === tempPassword) {
    if (!mustChangePassword) {
      await service.from("invigilators").update({ must_change_password: true }).eq("id", invigilator.id);
    }
    mustChangePassword = true;
  }

  return NextResponse.json({ mustChangePassword });
}
