import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/admin-context";
import { suggestOrganizationIds } from "@/lib/student-auth";
import { ChangePasswordForm } from "@/components/admin/change-password-form";

export default async function ChangePasswordPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/login");
  }

  let suggestions: string[] = [];
  let needsOrganizationId = false;
  let orgType: string | null = null;

  if (admin.organizationId) {
    const supabase = await createClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("name, slug, type")
      .eq("id", admin.organizationId)
      .maybeSingle();

    if (org && !org.slug) {
      needsOrganizationId = true;
      orgType = org.type;
      const candidates = suggestOrganizationIds(org.name);
      // Checking whether an Organization ID is taken is inherently a
      // cross-tenant question — org_admin_select_own_organization only
      // lets this admin see their own org row, so the regular client
      // would silently see every candidate as "available" even when
      // another org already has it. Service client for this one read.
      const service = createAdminClient();
      const { data: taken } = await service
        .from("organizations")
        .select("slug")
        .in("slug", candidates);
      const takenSet = new Set((taken ?? []).map((t) => t.slug));
      suggestions = candidates.filter((c) => !takenSet.has(c));
    }
  }

  return (
    <ChangePasswordForm
      needsOrganizationId={needsOrganizationId}
      suggestions={suggestions}
      isSchool={orgType === "SCHOOL"}
    />
  );
}
