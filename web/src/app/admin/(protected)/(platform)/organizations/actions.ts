"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthUser, deleteAuthUser } from "@/lib/create-auth-account";
import { requireSuperAdmin } from "@/lib/admin-context";

const ORG_TYPES = ["COLLEGE", "UNIVERSITY", "SCHOOL", "OTHER"] as const;

export type CreateOrgState =
  | { error: string }
  | { success: true; orgName: string; adminEmail: string; tempPassword: string }
  | undefined;

export async function createOrganizationWithAdmin(
  _prevState: CreateOrgState,
  formData: FormData,
): Promise<CreateOrgState> {
  await requireSuperAdmin();

  const orgName = String(formData.get("orgName") ?? "").trim();
  const orgType = String(formData.get("orgType") ?? "OTHER");
  const adminFullName = String(formData.get("adminFullName") ?? "").trim();
  const adminEmail = String(formData.get("adminEmail") ?? "").trim().toLowerCase();

  if (!orgName) return { error: "Organization name is required." };
  if (!ORG_TYPES.includes(orgType as (typeof ORG_TYPES)[number])) {
    return { error: "Invalid organization type." };
  }
  if (!adminFullName) return { error: "Admin name is required." };
  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    return { error: "A valid admin email is required." };
  }

  const service = createAdminClient();

  const { data: org, error: orgError } = await service
    .from("organizations")
    .insert({ name: orgName, type: orgType })
    .select("id")
    .single();

  if (orgError || !org) {
    return { error: orgError?.message ?? "Could not create organization." };
  }

  const created = await createAuthUser(adminEmail);
  if (!created.ok) {
    await service.from("organizations").delete().eq("id", org.id);
    return { error: created.error };
  }

  const { error: adminError } = await service.from("admins").insert({
    id: created.userId,
    full_name: adminFullName,
    email: adminEmail,
    role: "EXAM_STAFF",
    organization_id: org.id,
  });

  if (adminError) {
    await deleteAuthUser(created.userId);
    await service.from("organizations").delete().eq("id", org.id);
    return { error: adminError.message };
  }

  revalidatePath("/admin/organizations");
  return {
    success: true,
    orgName,
    adminEmail,
    tempPassword: created.tempPassword,
  };
}
