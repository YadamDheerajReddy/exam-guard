"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthUser, deleteAuthUser } from "@/lib/create-auth-account";
import { rollNumberToAuthEmail } from "@/lib/student-auth";
import { requireOrgAdmin } from "@/lib/admin-context";
import { validateRosterRows, type RosterRow } from "@/lib/roster";

export type RosterUploadResult = {
  rowNumber: number;
  ok: boolean;
  error?: string;
  tempPassword?: string;
  studentId?: string;
};

type IncomingRow = RosterRow & { rowNumber: number };

export async function uploadRoster(
  rows: IncomingRow[],
): Promise<RosterUploadResult[]> {
  const admin = await requireOrgAdmin();

  if (rows.length === 0) return [];

  // Re-validate server-side — never trust the client's pre-check alone.
  // validateRosterRows works on plain rows and knows nothing about the
  // caller's correlation ids, so zip rowNumber back on positionally
  // (it doesn't reorder or drop rows) rather than trying to read it off
  // its output.
  const revalidated = validateRosterRows(rows);
  const results: RosterUploadResult[] = [];
  const clean: (RosterRow & { rowNumber: number })[] = [];
  revalidated.forEach((row, i) => {
    if (row.error) {
      results.push({ rowNumber: rows[i].rowNumber, ok: false, error: row.error });
      return;
    }
    clean.push({ ...row, rowNumber: rows[i].rowNumber });
  });

  if (clean.length === 0) return results;

  const service = createAdminClient();

  const { data: org } = await service
    .from("organizations")
    .select("slug")
    .eq("id", admin.organizationId)
    .single();

  if (!org?.slug) {
    return clean.map((row) => ({
      rowNumber: row.rowNumber,
      ok: false,
      error: "Set your organization's Organization ID (Change Password page) before uploading a roster.",
    }));
  }
  const orgSlug = org.slug;

  // Two separate .in() lookups rather than one hand-built .or() filter
  // string — roll numbers/emails come straight from an uploaded CSV, and
  // interpolating untrusted values into a raw PostgREST filter string is
  // an injection risk if a cell contains a comma, paren, or quote.
  // Roll number is only unique within this org; email is unique platform-wide.
  const rollNumbers = clean.map((r) => r.rollNumber);
  const emails = clean.map((r) => r.email);
  const [{ data: existingByRoll }, { data: existingByEmail }] = await Promise.all([
    service
      .from("students")
      .select("roll_number")
      .eq("organization_id", admin.organizationId)
      .in("roll_number", rollNumbers),
    service.from("students").select("email").in("email", emails),
  ]);

  const existingRolls = new Set(existingByRoll?.map((r) => r.roll_number) ?? []);
  const existingEmails = new Set(existingByEmail?.map((r) => r.email) ?? []);

  for (const row of clean) {
    if (existingRolls.has(row.rollNumber)) {
      results.push({
        rowNumber: row.rowNumber,
        ok: false,
        error: "Roll number already exists.",
      });
      continue;
    }
    if (existingEmails.has(row.email)) {
      results.push({
        rowNumber: row.rowNumber,
        ok: false,
        error: "Email already exists.",
      });
      continue;
    }

    const created = await createAuthUser(
      rollNumberToAuthEmail(orgSlug, row.rollNumber),
      `${row.rollNumber}@${orgSlug}`,
    );
    if (!created.ok) {
      results.push({ rowNumber: row.rowNumber, ok: false, error: created.error });
      continue;
    }

    const { error: insertError } = await service.from("students").insert({
      id: created.userId,
      roll_number: row.rollNumber,
      full_name: row.fullName,
      email: row.email,
      department: row.department,
      photo_url: row.photoUrl || "",
      organization_id: admin.organizationId,
    });

    if (insertError) {
      await deleteAuthUser(created.userId);
      results.push({
        rowNumber: row.rowNumber,
        ok: false,
        error: insertError.message,
      });
      continue;
    }

    results.push({
      rowNumber: row.rowNumber,
      ok: true,
      tempPassword: created.tempPassword,
      studentId: created.userId,
    });
  }

  return results;
}

const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export type UploadPhotoResult = { ok: true; signedUrl: string } | { ok: false; error: string };

export async function uploadStudentPhoto(
  studentId: string,
  formData: FormData,
): Promise<UploadPhotoResult> {
  const admin = await requireOrgAdmin();

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file selected." };
  }
  const ext = PHOTO_EXTENSIONS[file.type];
  if (!ext) {
    return { ok: false, error: "Only JPEG, PNG, or WebP images are allowed." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "Image must be under 5MB." };
  }

  const service = createAdminClient();

  // Confirm the student actually belongs to this admin's org before
  // touching storage or their row — studentId comes from the client, and
  // server actions are untrusted entry points.
  const { data: student } = await service
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("organization_id", admin.organizationId)
    .maybeSingle();
  if (!student) {
    return { ok: false, error: "Student not found." };
  }

  const path = `${admin.organizationId}/${studentId}.${ext}`;
  const { error: uploadError } = await service.storage
    .from("student-photos")
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { error: updateError } = await service
    .from("students")
    .update({ photo_url: path })
    .eq("id", studentId);
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const { data: signed, error: signError } = await service.storage
    .from("student-photos")
    .createSignedUrl(path, 300);
  if (signError || !signed) {
    return { ok: false, error: signError?.message ?? "Uploaded, but couldn't preview it." };
  }

  return { ok: true, signedUrl: signed.signedUrl };
}
