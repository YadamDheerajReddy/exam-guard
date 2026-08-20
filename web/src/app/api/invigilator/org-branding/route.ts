import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInvigilator, UnauthorizedError } from "@/lib/invigilator-context";

// org-logos is a private bucket with no storage.objects policies — the
// mobile app holds no service-role key, so it can't sign this URL itself
// (same reasoning as roster/route.ts signing student-photo URLs). A 1h TTL
// rather than the 5min one the web admin/student headers use: this is
// fetched once per app session rather than re-rendered on every page load,
// and an invigilator's scanning session can run for hours.
export async function GET(request: Request) {
  let invigilator;
  try {
    invigilator = await requireInvigilator(request);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }

  const service = createAdminClient();
  const { data: org } = await service
    .from("organizations")
    .select("name, logo_url")
    .eq("id", invigilator.organizationId)
    .maybeSingle();

  let logoUrl: string | null = null;
  if (org?.logo_url) {
    const { data: signed } = await service.storage.from("org-logos").createSignedUrl(org.logo_url, 3600);
    logoUrl = signed?.signedUrl ?? null;
  }

  return NextResponse.json({ name: org?.name ?? null, logoUrl });
}
