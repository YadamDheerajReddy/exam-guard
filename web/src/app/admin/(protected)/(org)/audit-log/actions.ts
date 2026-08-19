"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/admin-context";

const CORRECTABLE_STATUSES = ["VERIFIED", "WRONG_HALL", "FLAGGED", "ABSENT"] as const;
export type CorrectionStatus = (typeof CORRECTABLE_STATUSES)[number];

// verification_logs is append-only (Backend Schema doc) — a correction is a
// NEW row pointing at the one it supersedes, never an update or delete of
// the original. That's what keeps the trail defensible: you can always see
// both what was recorded at the door and what an admin later decided.
export async function correctVerificationLog(
  originalLogId: string,
  status: string,
  reason: string,
): Promise<{ error?: string }> {
  const admin = await requireOrgAdmin();

  if (!CORRECTABLE_STATUSES.includes(status as CorrectionStatus)) {
    return { error: "Invalid status." };
  }
  const notes = reason.trim();
  if (!notes) {
    return { error: "A reason is required — it becomes part of the audit trail." };
  }

  const supabase = await createClient();

  // The read policy already scopes this to the admin's own org, so a
  // missing row here means "not yours" as much as "doesn't exist".
  const { data: original } = await supabase
    .from("verification_logs")
    .select("id, mapping_id, invigilator_id, corrects_log_id")
    .eq("id", originalLogId)
    .maybeSingle();

  if (!original) return { error: "That log entry could not be found." };
  if (original.corrects_log_id) {
    return { error: "That entry is itself a correction — correct the original scan instead." };
  }

  const { data: existingCorrection } = await supabase
    .from("verification_logs")
    .select("id")
    .eq("corrects_log_id", originalLogId)
    .maybeSingle();
  if (existingCorrection) {
    return { error: "This scan has already been corrected." };
  }

  const { error } = await supabase.from("verification_logs").insert({
    mapping_id: original.mapping_id,
    // Kept pointing at the original invigilator so the trail still shows who
    // was at the door; corrected_by records who overrode it.
    invigilator_id: original.invigilator_id,
    client_event_id: randomUUID(),
    status,
    notes,
    corrects_log_id: originalLogId,
    corrected_by: admin.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/audit-log");
  revalidatePath("/admin/attendance");
  return {};
}
