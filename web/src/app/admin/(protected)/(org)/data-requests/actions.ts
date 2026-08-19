"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAdmin } from "@/lib/admin-context";
import { eraseOrAnonymizeStudent } from "@/lib/student-erasure";

export async function rejectDataRightsRequest(requestId: string, reason: string): Promise<{ error?: string }> {
  const admin = await requireOrgAdmin();
  if (!reason.trim()) return { error: "A reason is required — it's recorded on the request." };

  const service = createAdminClient();
  const { error } = await service
    .from("data_rights_requests")
    .update({
      status: "REJECTED",
      resolution_notes: reason.trim(),
      resolved_at: new Date().toISOString(),
      resolved_by: admin.id,
    })
    .eq("id", requestId)
    .eq("organization_id", admin.organizationId)
    .eq("status", "PENDING");

  if (error) return { error: error.message };
  revalidatePath("/admin/data-requests");
  return {};
}

export async function completeDataRightsRequest(requestId: string, notes: string): Promise<{ error?: string }> {
  const admin = await requireOrgAdmin();
  const service = createAdminClient();

  const { data: request } = await service
    .from("data_rights_requests")
    .select("id, request_type, organization_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.organization_id !== admin.organizationId) return { error: "Request not found." };
  if (request.request_type === "ERASURE") return { error: "Use the erasure action for this request type." };
  if (request.status !== "PENDING") return { error: "Already resolved." };

  const { error } = await service
    .from("data_rights_requests")
    .update({
      status: "COMPLETED",
      resolution_notes: notes.trim() || null,
      resolved_at: new Date().toISOString(),
      resolved_by: admin.id,
    })
    .eq("id", requestId);

  if (error) return { error: error.message };
  revalidatePath("/admin/data-requests");
  return {};
}

export async function fulfillErasureRequest(
  requestId: string,
): Promise<{ error?: string; action?: "anonymized" | "deleted" }> {
  const admin = await requireOrgAdmin();
  const service = createAdminClient();

  const { data: request } = await service
    .from("data_rights_requests")
    .select("id, student_id, organization_id, request_type, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.organization_id !== admin.organizationId) return { error: "Request not found." };
  if (request.request_type !== "ERASURE") return { error: "Not an erasure request." };
  if (request.status !== "PENDING") return { error: "Already resolved." };
  if (!request.student_id) return { error: "The student on this request no longer exists." };

  const { action, resolutionNotes } = await eraseOrAnonymizeStudent(service, request.student_id);

  const { error } = await service
    .from("data_rights_requests")
    .update({
      status: "COMPLETED",
      resolution_notes: resolutionNotes,
      resolved_at: new Date().toISOString(),
      resolved_by: admin.id,
    })
    .eq("id", requestId);

  if (error) return { error: error.message };
  revalidatePath("/admin/data-requests");
  revalidatePath("/admin/students");
  return { action };
}
