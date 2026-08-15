"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rollNumberToAuthEmail } from "@/lib/student-auth";
import { validateRosterRows, type RosterRow } from "@/lib/roster";

export type RosterUploadResult = {
  rowNumber: number;
  ok: boolean;
  error?: string;
  tempPassword?: string;
};

type IncomingRow = RosterRow & { rowNumber: number };

function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

async function assertIsAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: admin } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!admin) throw new Error("Not authorized.");
}

export async function uploadRoster(
  rows: IncomingRow[],
): Promise<RosterUploadResult[]> {
  await assertIsAdmin();

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

  const admin = createAdminClient();

  // Two separate .in() lookups rather than one hand-built .or() filter
  // string — roll numbers/emails come straight from an uploaded CSV, and
  // interpolating untrusted values into a raw PostgREST filter string is
  // an injection risk if a cell contains a comma, paren, or quote.
  const rollNumbers = clean.map((r) => r.rollNumber);
  const emails = clean.map((r) => r.email);
  const [{ data: existingByRoll }, { data: existingByEmail }] = await Promise.all([
    admin.from("students").select("roll_number").in("roll_number", rollNumbers),
    admin.from("students").select("email").in("email", emails),
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

    const tempPassword = generateTempPassword();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: rollNumberToAuthEmail(row.rollNumber),
      password: tempPassword,
      email_confirm: true,
    });

    if (createError || !created.user) {
      results.push({
        rowNumber: row.rowNumber,
        ok: false,
        error: createError?.message ?? "Could not create account.",
      });
      continue;
    }

    const { error: insertError } = await admin.from("students").insert({
      id: created.user.id,
      roll_number: row.rollNumber,
      full_name: row.fullName,
      email: row.email,
      department: row.department,
      photo_url: row.photoUrl || "",
    });

    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id);
      results.push({
        rowNumber: row.rowNumber,
        ok: false,
        error: insertError.message,
      });
      continue;
    }

    results.push({ rowNumber: row.rowNumber, ok: true, tempPassword });
  }

  return results;
}
