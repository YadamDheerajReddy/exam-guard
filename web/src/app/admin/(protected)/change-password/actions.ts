"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/admin-context";
import { slugify } from "@/lib/student-auth";

export type ChangePasswordState = { error?: string } | undefined;

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/login");
  }

  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const organizationIdInput = formData.get("organizationId");
  const grievanceOfficerName = String(formData.get("grievanceOfficerName") ?? "").trim();
  const grievanceOfficerEmail = String(formData.get("grievanceOfficerEmail") ?? "").trim();
  const dpdpAcknowledged = formData.get("dpdpAcknowledged") === "on";

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const service = createAdminClient();

  // organizationId is only present in the form when the org doesn't have
  // one yet (see page.tsx) — a voluntary password change later omits it
  // entirely, so we shouldn't require or touch it (or the DPDP fields
  // below, captured at this same one-time onboarding step) then.
  let organizationSlug: string | null = null;
  if (organizationIdInput !== null) {
    const slug = slugify(String(organizationIdInput));
    if (slug.length < 3) {
      return { error: "Organization ID must be at least 3 characters." };
    }

    const { data: taken } = await service
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (taken && taken.id !== admin.organizationId) {
      return { error: "That Organization ID is already taken — choose another." };
    }

    organizationSlug = slug;

    if (!grievanceOfficerName || !grievanceOfficerEmail) {
      return { error: "A Grievance Officer name and email are required." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(grievanceOfficerEmail)) {
      return { error: "Enter a valid Grievance Officer email." };
    }
    if (!dpdpAcknowledged) {
      return { error: "You must confirm the data protection acknowledgment to continue." };
    }
  }

  const supabase = await createClient();
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return { error: updateError.message };
  }

  // Service client, but every update below is hardcoded to specific
  // columns and scoped to ids derived from the verified session above —
  // never client-supplied — so this can't be used to touch anyone else's
  // row or admin.organizationId itself.
  //
  // Slug first, must_change_password last: if the slug update fails (e.g.
  // a last-second uniqueness collision), the admin stays flagged and lands
  // back on this same full form instead of a half-completed state where
  // the password changed but the org never got its Organization ID.
  if (organizationSlug && admin.organizationId) {
    const { error: orgError } = await service
      .from("organizations")
      .update({
        slug: organizationSlug,
        grievance_officer_name: grievanceOfficerName,
        grievance_officer_email: grievanceOfficerEmail,
        dpdp_acknowledged_at: new Date().toISOString(),
        dpdp_acknowledged_by: admin.id,
      })
      .eq("id", admin.organizationId);
    if (orgError) {
      return { error: orgError.message };
    }
  }

  await service.from("admins").update({ must_change_password: false }).eq("id", admin.id);

  redirect("/admin");
}
