import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAdmin } from "@/lib/admin-context";
import { StudentsTable } from "@/components/admin/students-table";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ missingPhoto?: string }>;
}) {
  const admin = await requireOrgAdmin();
  const { missingPhoto } = await searchParams;
  const supabase = await createClient();

  const [{ data: students }, { data: org }] = await Promise.all([
    supabase
      .from("students")
      .select("id, roll_number, full_name, email, department, photo_url, is_active")
      .eq("organization_id", admin.organizationId)
      .order("roll_number", { ascending: true }),
    supabase.from("organizations").select("type").eq("id", admin.organizationId).maybeSingle(),
  ]);
  const isSchool = org?.type === "SCHOOL";

  const photoPaths = (students ?? [])
    .map((s) => s.photo_url)
    .filter((p): p is string => Boolean(p));

  const signedUrlByPath = new Map<string, string>();
  if (photoPaths.length > 0) {
    const service = createAdminClient();
    const { data: signed } = await service.storage
      .from("student-photos")
      .createSignedUrls(photoPaths, 300);
    for (const s of signed ?? []) {
      if (s.signedUrl) signedUrlByPath.set(s.path ?? "", s.signedUrl);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Students</h1>
      <p className="mt-1 text-sm text-slate">
        Every student ever added to your organization — this list has no
        30-day limit, unlike the Roster Upload page&rsquo;s recent-activity log.
      </p>

      <div className="mt-6">
        <StudentsTable
          initialMissingPhotoOnly={missingPhoto === "1"}
          isSchool={isSchool}
          students={(students ?? []).map((s) => ({
            id: s.id,
            rollNumber: s.roll_number,
            fullName: s.full_name,
            email: s.email,
            department: s.department,
            isActive: s.is_active,
            photoUrl: s.photo_url ? (signedUrlByPath.get(s.photo_url) ?? null) : null,
            hasPhoto: Boolean(s.photo_url?.trim()),
          }))}
        />
      </div>
    </div>
  );
}
