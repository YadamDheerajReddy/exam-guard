"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin } from "@/lib/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

export type ChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ChangeRequestRow = {
  id: string;
  subject: string;
  details: string;
  status: ChangeRequestStatus;
  superAdminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

// Things an org admin genuinely can't self-serve (org name, slug, type —
// identity fields, not the address/logo/contact fields already editable
// above) go through here instead: a free-text request a super admin
// reviews and acts on manually, rather than a rigid per-field change
// mechanism that would need updating every time a new editable field is
// added elsewhere in Settings.
export async function listMyChangeRequests(): Promise<ChangeRequestRow[]> {
  const admin = await requireOrgAdmin();
  const service = createAdminClient();
  const { data } = await service
    .from("change_requests")
    .select("id, subject, details, status, super_admin_notes, created_at, reviewed_at")
    .eq("organization_id", admin.organizationId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    subject: r.subject,
    details: r.details,
    status: r.status as ChangeRequestStatus,
    superAdminNotes: r.super_admin_notes,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
  }));
}

export async function submitChangeRequest(formData: FormData): Promise<{ error?: string }> {
  const admin = await requireOrgAdmin();

  const subject = String(formData.get("subject") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  if (!subject) return { error: "Subject is required." };
  if (!details) return { error: "Describe what you'd like changed." };

  const service = createAdminClient();
  const { error } = await service.from("change_requests").insert({
    organization_id: admin.organizationId,
    requested_by: admin.id,
    subject,
    details,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return {};
}
