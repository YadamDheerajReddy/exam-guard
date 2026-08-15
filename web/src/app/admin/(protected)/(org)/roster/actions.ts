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
};

type IncomingRow = RosterRow & { rowNumber: number };

export async function uploadRoster(
  rows: IncomingRow[],
): Promise<RosterUploadResult[]> {
  const admin = await requireOrgAdmin();

  if (rows.length === 0) return [];

  // Re-validate server-side — never trust the client's pre-check alone.
  const revalidated = validateRosterRows(rows);
  const results: RosterUploadResult[] = [];
  const clean = revalidated.filter((row, i) => {
    if (row.error) {
      results.push({ rowNumber: rows[i].rowNumber, ok: false, error: row.error });
      return false;
    }
    return true;
  });

  if (clean.length === 0) return results;

  const service = createAdminClient();

  const { data: org } = await service
    .from("organizations")
    .select("slug")
    .eq("id", admin.organizationId)
    .single();
  const orgSlug = org!.slug;

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

    const created = await createAuthUser(rollNumberToAuthEmail(orgSlug, row.rollNumber));
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

    results.push({ rowNumber: row.rowNumber, ok: true, tempPassword: created.tempPassword });
  }

  return results;
}
