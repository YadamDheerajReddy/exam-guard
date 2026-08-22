"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createAuthUser, deleteAuthUser, generateTempPassword } from "@/lib/create-auth-account";
import { requireSuperAdmin } from "@/lib/admin-context";
import { sendMail } from "@/lib/mailer";
import { orgAdminCreatedEmail, orgAdminPasswordResetEmail } from "@/lib/email-templates";
import { absoluteUrl } from "@/lib/site-url";
import { isCommonTimeZone } from "@/lib/timezone";
import { MAX_ADMINS_PER_ORG } from "@/lib/admin-capacity";
import { slugify, rollNumberToAuthEmail } from "@/lib/student-auth";

const ORG_TYPES = ["COLLEGE", "UNIVERSITY", "SCHOOL", "OTHER"] as const;
const ORG_ADMIN_ROLES = ["EXAM_STAFF", "AUDITOR"] as const;

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
  const orgTimezone = String(formData.get("orgTimezone") ?? "Asia/Kolkata");
  const adminFullName = String(formData.get("adminFullName") ?? "").trim();
  const adminEmail = String(formData.get("adminEmail") ?? "").trim().toLowerCase();

  if (!orgName) return { error: "Organization name is required." };
  if (!ORG_TYPES.includes(orgType as (typeof ORG_TYPES)[number])) {
    return { error: "Invalid organization type." };
  }
  // Server actions are untrusted entry points, and this value feeds every
  // reveal/completion calculation for the org — validate against the closed
  // list rather than trusting the select.
  if (!isCommonTimeZone(orgTimezone)) {
    return { error: "Invalid timezone." };
  }
  if (!adminFullName) return { error: "Admin name is required." };
  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    return { error: "A valid admin email is required." };
  }

  const service = createAdminClient();

  // No slug yet — the org admin picks their own Organization ID on first
  // login (see change-password/actions.ts). Roster upload and student
  // login are blocked until that's set.
  const { data: org, error: orgError } = await service
    .from("organizations")
    .insert({ name: orgName, type: orgType, timezone: orgTimezone })
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
    must_change_password: true,
  });

  if (adminError) {
    await deleteAuthUser(created.userId);
    await service.from("organizations").delete().eq("id", org.id);
    return { error: adminError.message };
  }

  const { subject, html } = orgAdminCreatedEmail({
    orgName,
    fullName: adminFullName,
    email: adminEmail,
    tempPassword: created.tempPassword,
    loginUrl: await absoluteUrl("/admin/login"),
  });
  await sendMail({ to: adminEmail, subject, html });

  revalidatePath("/admin/organizations");
  return {
    success: true,
    orgName,
    adminEmail,
    tempPassword: created.tempPassword,
  };
}

export async function setOrganizationSuspended(
  organizationId: string,
  suspended: boolean,
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ is_suspended: suspended })
    .eq("id", organizationId);

  if (error) return { error: error.message };
  revalidatePath("/admin/organizations");
  return {};
}

export type AddOrgAdminResult = { error?: string };

// Every other admins-table insert in this codebase is bundled inside
// createOrganizationWithAdmin above (one admin, created with the org
// itself). This is the first standalone "add another admin to an
// already-existing org" path — same createAuthUser/rollback/email pattern,
// but capped and with a role choice, since a super admin adding staff
// after the fact plausibly wants an AUDITOR, not just another EXAM_STAFF.
export async function addOrgAdmin(organizationId: string, formData: FormData): Promise<AddOrgAdminResult> {
  await requireSuperAdmin();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "EXAM_STAFF");

  if (!fullName) return { error: "Admin name is required." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "A valid email is required." };
  }
  if (!ORG_ADMIN_ROLES.includes(role as (typeof ORG_ADMIN_ROLES)[number])) {
    return { error: "Invalid role." };
  }

  const service = createAdminClient();

  const { data: org } = await service.from("organizations").select("name").eq("id", organizationId).maybeSingle();
  if (!org) return { error: "Organization not found." };

  const { count } = await service
    .from("admins")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if ((count ?? 0) >= MAX_ADMINS_PER_ORG) {
    return { error: `This organization already has the maximum of ${MAX_ADMINS_PER_ORG} admins.` };
  }

  const created = await createAuthUser(email);
  if (!created.ok) return { error: created.error };

  const { error: adminError } = await service.from("admins").insert({
    id: created.userId,
    full_name: fullName,
    email,
    role,
    organization_id: organizationId,
    must_change_password: true,
  });

  if (adminError) {
    await deleteAuthUser(created.userId);
    if (adminError.code === "23505") {
      return { error: "An admin with that email already exists." };
    }
    return { error: adminError.message };
  }

  const { subject, html } = orgAdminCreatedEmail({
    orgName: org.name,
    fullName,
    email,
    tempPassword: created.tempPassword,
    loginUrl: await absoluteUrl("/admin/login"),
  });
  await sendMail({ to: email, subject, html });

  revalidatePath("/admin/organizations");
  return {};
}

export type UpdateOrgDetailsResult = { error?: string; migratedStudents?: number };

// Name is freely editable — it's display/branding only, never baked into an
// auth identity. Slug ("Organization ID") is different: student sign-in
// uses a synthetic {rollNumber}.{orgSlug}@examguard.internal address that's
// written into auth.users.email at roster-upload time, not re-derived from
// the org's current slug on every login. Changing the slug without
// migrating those emails would silently lock out every existing student on
// their next login attempt, so this re-points auth.users.email for each of
// them to the new slug in the same call. Passwords are left untouched —
// only the email identifier moves, so whatever password a student is
// already on (temp or self-chosen) keeps working.
export async function updateOrganizationDetails(
  organizationId: string,
  formData: FormData,
): Promise<UpdateOrgDetailsResult> {
  await requireSuperAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();

  if (!name) return { error: "Organization name is required." };

  const service = createAdminClient();

  const { data: org } = await service.from("organizations").select("slug").eq("id", organizationId).maybeSingle();
  if (!org) return { error: "Organization not found." };

  const { error: nameError } = await service.from("organizations").update({ name }).eq("id", organizationId);
  if (nameError) return { error: nameError.message };

  if (!rawSlug) {
    revalidatePath("/admin/organizations");
    return {};
  }

  const newSlug = slugify(rawSlug);
  if (newSlug.length < 3) return { error: "Organization ID must be at least 3 characters." };
  if (newSlug === org.slug) {
    revalidatePath("/admin/organizations");
    return {};
  }

  const { data: taken } = await service.from("organizations").select("id").eq("slug", newSlug).maybeSingle();
  if (taken && taken.id !== organizationId) {
    return { error: "That Organization ID is already taken — choose another." };
  }

  const { error: slugError } = await service.from("organizations").update({ slug: newSlug }).eq("id", organizationId);
  if (slugError) return { error: slugError.message };

  const { data: students } = await service
    .from("students")
    .select("id, roll_number")
    .eq("organization_id", organizationId);

  let migratedStudents = 0;
  for (const student of students ?? []) {
    const { error } = await service.auth.admin.updateUserById(student.id, {
      email: rollNumberToAuthEmail(newSlug, student.roll_number),
    });
    if (!error) migratedStudents += 1;
  }

  revalidatePath("/admin/organizations");
  return { migratedStudents };
}

// The only standalone "delete an admin" path in the codebase (invigilators
// only get a soft is_active toggle, students go through the erasure-request
// flow) — org admins have no self-service or org-admin-triggered deletion,
// so this is exclusively a super-admin capability. Blocks removing an
// org's last admin rather than leaving it with zero, since there'd be no
// way back in short of another super-admin intervention anyway.
export async function deleteOrgAdmin(organizationId: string, adminId: string): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const service = createAdminClient();

  const { data: target } = await service
    .from("admins")
    .select("id, role")
    .eq("id", adminId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!target || target.role === "SUPER_ADMIN") return { error: "Admin not found." };

  const { count } = await service
    .from("admins")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if ((count ?? 0) <= 1) {
    return { error: "Can't delete the last admin of an organization." };
  }

  // admins.id -> auth.users.id is ON DELETE CASCADE, so removing the auth
  // user is sufficient — no separate admins-row delete needed.
  const { error } = await service.auth.admin.deleteUser(adminId);
  if (error) return { error: error.message };

  revalidatePath("/admin/organizations");
  return {};
}

// Org admins have real institutional emails (unlike students/invigilators'
// deterministic slug-derived temp passwords), so this mirrors the
// email-delivery pattern from createOrganizationWithAdmin/addOrgAdmin above
// rather than the on-screen-display pattern used by
// resetInvigilatorPassword/resetStudentPassword.
export async function resetOrgAdminPassword(organizationId: string, adminId: string): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const service = createAdminClient();

  const { data: target } = await service
    .from("admins")
    .select("id, full_name, email")
    .eq("id", adminId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!target) return { error: "Admin not found." };

  const { data: org } = await service.from("organizations").select("name").eq("id", organizationId).maybeSingle();
  if (!org) return { error: "Organization not found." };

  const tempPassword = generateTempPassword();
  const { error: authError } = await service.auth.admin.updateUserById(adminId, { password: tempPassword });
  if (authError) return { error: authError.message };

  await service.from("admins").update({ must_change_password: true }).eq("id", adminId);

  const { subject, html } = orgAdminPasswordResetEmail({
    orgName: org.name,
    fullName: target.full_name,
    email: target.email,
    tempPassword,
    loginUrl: await absoluteUrl("/admin/login"),
  });
  await sendMail({ to: target.email, subject, html });

  revalidatePath("/admin/organizations");
  return {};
}

// Full, permanent teardown of an organization and everything under it —
// admins, students, invigilators, halls, exams, seat mappings, verification
// logs, change/data-rights requests, roster-upload history, hall-ticket
// templates, and every Storage file (logo, signatures, student photos).
// Gated by typing the org's exact name (checked server-side, not just in
// the UI) since this is irreversible and has no soft-delete/undo path —
// unlike setOrganizationSuspended, which is the reversible "hold" option.
export async function deleteOrganization(organizationId: string, confirmName: string): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const service = createAdminClient();

  const { data: org } = await service
    .from("organizations")
    .select("name, logo_url, hall_ticket_signature1_url, hall_ticket_signature2_url")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org) return { error: "Organization not found." };
  if (confirmName.trim() !== org.name) {
    return { error: "That doesn't match the organization's name — nothing was deleted." };
  }

  const [{ data: students }, { data: invigilators }, { data: admins }] = await Promise.all([
    service.from("students").select("id, photo_url").eq("organization_id", organizationId),
    service.from("invigilators").select("id").eq("organization_id", organizationId),
    service.from("admins").select("id").eq("organization_id", organizationId),
  ]);
  const studentIds = (students ?? []).map((s) => s.id);
  const invigilatorIds = (invigilators ?? []).map((i) => i.id);
  const adminIds = (admins ?? []).map((a) => a.id);

  const { data: mappings } = studentIds.length
    ? await service.from("student_exam_mappings").select("id").in("student_id", studentIds)
    : { data: [] };
  const mappingIds = (mappings ?? []).map((m) => m.id);

  // Tables with no cascade from admins/invigilators/mappings — clear first,
  // same dependency order as a full-database wipe.
  if (mappingIds.length) await service.from("verification_logs").delete().in("mapping_id", mappingIds);
  if (invigilatorIds.length) await service.from("verification_logs").delete().in("invigilator_id", invigilatorIds);
  await service.from("change_requests").delete().eq("organization_id", organizationId);
  await service.from("data_rights_requests").delete().eq("organization_id", organizationId);
  await service.from("roster_uploads").delete().eq("organization_id", organizationId);
  await service.from("hall_ticket_templates").delete().eq("organization_id", organizationId);
  if (studentIds.length) await service.from("student_exam_mappings").delete().in("student_id", studentIds);

  // Deleting each auth user cascades away their admins/students/invigilators
  // profile row automatically (all three have ON DELETE CASCADE from
  // auth.users.id) — no separate profile-table deletes needed.
  for (const id of [...studentIds, ...invigilatorIds, ...adminIds]) {
    await service.auth.admin.deleteUser(id);
  }

  await service.from("exams").delete().eq("organization_id", organizationId);
  await service.from("exam_groups").delete().eq("organization_id", organizationId);
  await service.from("halls").delete().eq("organization_id", organizationId);

  const { error: orgError } = await service.from("organizations").delete().eq("id", organizationId);
  if (orgError) return { error: orgError.message };

  const storagePaths: [string, string][] = [];
  if (org.logo_url) storagePaths.push(["org-logos", org.logo_url]);
  if (org.hall_ticket_signature1_url) storagePaths.push(["hall-ticket-signatures", org.hall_ticket_signature1_url]);
  if (org.hall_ticket_signature2_url) storagePaths.push(["hall-ticket-signatures", org.hall_ticket_signature2_url]);
  for (const student of students ?? []) {
    if (student.photo_url) storagePaths.push(["student-photos", student.photo_url]);
  }
  const byBucket = new Map<string, string[]>();
  for (const [bucket, path] of storagePaths) {
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path]);
  }
  for (const [bucket, paths] of byBucket) {
    await service.storage.from(bucket).remove(paths);
  }

  revalidatePath("/admin/organizations");
  return {};
}
