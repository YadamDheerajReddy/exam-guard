"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthUser, deleteAuthUser } from "@/lib/create-auth-account";
import { requireOrgAdmin } from "@/lib/admin-context";
import { invigilatorTempPassword } from "@/lib/student-auth";
import { sendMail } from "@/lib/mailer";
import { invigilatorCreatedEmail } from "@/lib/email-templates";
import { MAX_INVIGILATORS_PER_HALL } from "@/lib/hall-capacity";

export type CreateInvigilatorState =
  | { error: string }
  | { success: true; email: string; tempPassword: string }
  | undefined;

// Only active invigilators occupy a slot — an inactive one is already
// blocked from every /api/invigilator/* call (requireInvigilator), so it
// isn't functionally staffing the hall. Counting it anyway would strand an
// admin who deactivated someone and now can't assign their replacement to
// the same room.
async function activeInvigilatorCountInHall(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
  hallId: string,
  excludeInvigilatorId?: string,
): Promise<number> {
  let query = supabase
    .from("invigilators")
    .select("id", { count: "exact", head: true })
    .eq("assigned_hall_id", hallId)
    .eq("is_active", true);
  if (excludeInvigilatorId) query = query.neq("id", excludeInvigilatorId);
  const { count } = await query;
  return count ?? 0;
}

function hallFullError(): { error: string } {
  return {
    error: `This hall already has ${MAX_INVIGILATORS_PER_HALL} active invigilators assigned. Reassign or deactivate one first.`,
  };
}

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

  const { data: org } = await service
    .from("organizations")
    .select("name, slug")
    .eq("id", admin.organizationId)
    .maybeSingle();
  if (!org?.slug) {
    return { error: "Set your organization's Organization ID (Change Password page) before adding invigilators." };
  }

  const { data: existing } = await service
    .from("invigilators")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return { error: "An invigilator with that email already exists." };

  // New invigilators are active by default (schema default), so they'd
  // occupy a slot immediately.
  if (assignedHallId && (await activeInvigilatorCountInHall(service, assignedHallId)) >= MAX_INVIGILATORS_PER_HALL) {
    return hallFullError();
  }

  // Deterministic like the student temp password — {organizationName}@#{organizationId}
  // — so an admin printing exam-day instructions can hand every invigilator
  // the same login line rather than looking up individual passwords.
  const tempPassword = invigilatorTempPassword(org.name, org.slug);
  const created = await createAuthUser(email, tempPassword);
  if (!created.ok) return { error: created.error };

  const { error: insertError } = await service.from("invigilators").insert({
    id: created.userId,
    full_name: fullName,
    email,
    assigned_hall_id: assignedHallId,
    organization_id: admin.organizationId,
    must_change_password: true,
  });

  if (insertError) {
    await deleteAuthUser(created.userId);
    return { error: insertError.message };
  }

  const { subject, html } = invigilatorCreatedEmail({
    orgName: org.name,
    fullName,
    email,
    tempPassword: created.tempPassword,
  });
  await sendMail({ to: email, subject, html });

  revalidatePath("/admin/invigilators");
  return { success: true, email, tempPassword: created.tempPassword };
}

export type ResetInvigilatorPasswordResult =
  | { ok: true; tempPassword: string }
  | { ok: false; error: string };

// Mirrors resetStudentPassword: invigilators have no self-service reset
// (see mobile login screen — "contact your admin" is the whole flow), so
// this is the only way one gets back in after a forgotten password.
// Regenerates the same deterministic temp password used at creation
// ({organizationName}@#{organizationSlug}) and forces a change on next
// login, same as a freshly-created account.
export async function resetInvigilatorPassword(invigilatorId: string): Promise<ResetInvigilatorPasswordResult> {
  const admin = await requireOrgAdmin();
  const service = createAdminClient();

  const { data: invigilator } = await service
    .from("invigilators")
    .select("id")
    .eq("id", invigilatorId)
    .eq("organization_id", admin.organizationId)
    .maybeSingle();
  if (!invigilator) {
    return { ok: false, error: "Invigilator not found." };
  }

  const { data: org } = await service
    .from("organizations")
    .select("name, slug")
    .eq("id", admin.organizationId)
    .maybeSingle();
  if (!org?.slug) {
    return { ok: false, error: "Set your organization's Organization ID first (Change Password page)." };
  }

  const tempPassword = invigilatorTempPassword(org.name, org.slug);
  const { error: authError } = await service.auth.admin.updateUserById(invigilatorId, {
    password: tempPassword,
  });
  if (authError) {
    return { ok: false, error: authError.message };
  }

  await service.from("invigilators").update({ must_change_password: true }).eq("id", invigilatorId);

  revalidatePath("/admin/invigilators");
  return { ok: true, tempPassword };
}

export async function setInvigilatorActive(
  invigilatorId: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  await requireOrgAdmin();
  const supabase = await createClient();

  // Reactivating can silently overflow a hall: assign A and B to a hall
  // (full), deactivate A, assign C to the now-open slot, then reactivate A
  // — without this check that hall ends up with 3 active invigilators.
  if (isActive) {
    const { data: invigilator } = await supabase
      .from("invigilators")
      .select("assigned_hall_id")
      .eq("id", invigilatorId)
      .maybeSingle();
    if (
      invigilator?.assigned_hall_id &&
      (await activeInvigilatorCountInHall(supabase, invigilator.assigned_hall_id, invigilatorId)) >=
        MAX_INVIGILATORS_PER_HALL
    ) {
      return hallFullError();
    }
  }

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

  // An inactive invigilator doesn't occupy a slot (requireInvigilator blocks
  // every API call for them regardless), so pre-assigning one to an
  // otherwise-full hall is fine — the cap only has to hold once they're
  // active, which setInvigilatorActive enforces separately at that point.
  if (hallId) {
    const { data: invigilator } = await supabase
      .from("invigilators")
      .select("is_active")
      .eq("id", invigilatorId)
      .maybeSingle();
    if (
      invigilator?.is_active &&
      (await activeInvigilatorCountInHall(supabase, hallId, invigilatorId)) >= MAX_INVIGILATORS_PER_HALL
    ) {
      return hallFullError();
    }
  }

  const { error } = await supabase
    .from("invigilators")
    .update({ assigned_hall_id: hallId || null })
    .eq("id", invigilatorId);

  if (error) return { error: error.message };
  revalidatePath("/admin/invigilators");
  return {};
}
