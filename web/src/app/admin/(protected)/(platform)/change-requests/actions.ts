"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

export type ChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type PlatformChangeRequestRow = {
  id: string;
  organizationId: string;
  organizationName: string;
  requestedByName: string;
  subject: string;
  details: string;
  status: ChangeRequestStatus;
  superAdminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export async function listAllChangeRequests(): Promise<PlatformChangeRequestRow[]> {
  await requireSuperAdmin();
  const service = createAdminClient();

  const { data } = await service
    .from("change_requests")
    .select(
      "id, organization_id, subject, details, status, super_admin_notes, created_at, reviewed_at, organizations(name), admins!requested_by(full_name)",
    )
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => {
    const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
    const requester = Array.isArray(r.admins) ? r.admins[0] : r.admins;
    return {
      id: r.id,
      organizationId: r.organization_id,
      organizationName: org?.name ?? "Unknown organization",
      requestedByName: requester?.full_name ?? "Unknown admin",
      subject: r.subject,
      details: r.details,
      status: r.status as ChangeRequestStatus,
      superAdminNotes: r.super_admin_notes,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    };
  });
}

export async function reviewChangeRequest(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  notes: string,
): Promise<{ error?: string }> {
  const superAdmin = await requireSuperAdmin();
  const service = createAdminClient();

  // Reviewing is one-shot by design — once a decision is recorded it stays
  // final rather than allowing a silent re-review, mirroring how the org
  // side never gets to edit a request after submitting it either.
  const { error } = await service
    .from("change_requests")
    .update({
      status: decision,
      super_admin_notes: notes.trim() || null,
      reviewed_by: superAdmin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "PENDING");
  if (error) return { error: error.message };

  revalidatePath("/admin/change-requests");
  return {};
}
