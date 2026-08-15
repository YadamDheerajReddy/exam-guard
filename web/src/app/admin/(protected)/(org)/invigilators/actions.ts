"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthUser, deleteAuthUser } from "@/lib/create-auth-account";
import { requireOrgAdmin } from "@/lib/admin-context";

export type CreateInvigilatorState =
  | { error: string }
  | { success: true; email: string; tempPassword: string }
  | undefined;

export async function createInvigilator(
  _prevState: CreateInvigilatorState,
  formData: FormData,
): Promise<CreateInvigilatorState> {
  const admin = await requireOrgAdmin();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const assignedHallId = String(formData.get("assignedHallId") ?? "") || null;

  if (!fullName) return { error: "Name is required." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "A valid email is required." };
  }

  const service = createAdminClient();

  const { data: existing } = await service
    .from("invigilators")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return { error: "An invigilator with that email already exists." };

  const created = await createAuthUser(email);
  if (!created.ok) return { error: created.error };

  const { error: insertError } = await service.from("invigilators").insert({
    id: created.userId,
    full_name: fullName,
    email,
    assigned_hall_id: assignedHallId,
    organization_id: admin.organizationId,
  });

  if (insertError) {
    await deleteAuthUser(created.userId);
    return { error: insertError.message };
  }

  revalidatePath("/admin/invigilators");
  return { success: true, email, tempPassword: created.tempPassword };
}

export async function setInvigilatorActive(
  invigilatorId: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  await requireOrgAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("invigilators")
    .update({ is_active: isActive })
    .eq("id", invigilatorId);

  if (error) return { error: error.message };
  revalidatePath("/admin/invigilators");
  return {};
}

export async function reassignInvigilatorHall(
  invigilatorId: string,
  hallId: string,
): Promise<{ error?: string }> {
  await requireOrgAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("invigilators")
    .update({ assigned_hall_id: hallId || null })
    .eq("id", invigilatorId);

  if (error) return { error: error.message };
  revalidatePath("/admin/invigilators");
  return {};
}
