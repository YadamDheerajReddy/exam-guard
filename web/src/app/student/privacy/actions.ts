"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudent } from "@/lib/student-context";

const REQUEST_TYPES = ["ACCESS", "CORRECTION", "ERASURE"] as const;
export type DataRightsRequestType = (typeof REQUEST_TYPES)[number];

export type SubmitDataRightsRequestState = { error?: string; ok?: true } | undefined;

// A Data Principal's own exercise of the DPDP Act's access/correction/
// erasure rights. This only files the request — an org admin reviews and
// fulfills it (see admin/data-requests/actions.ts) rather than it
// executing automatically, since e.g. an erasure request may need to wait
// on a legitimate retention basis (an unresolved dispute over one of this
// student's verification records), which the Act itself allows for.
export async function submitDataRightsRequest(
  _prevState: SubmitDataRightsRequestState,
  formData: FormData,
): Promise<SubmitDataRightsRequestState> {
  const student = await requireStudent();

  const requestType = String(formData.get("requestType") ?? "");
  const details = String(formData.get("details") ?? "").trim();

  if (!REQUEST_TYPES.includes(requestType as DataRightsRequestType)) {
    return { error: "Invalid request type." };
  }

  const service = createAdminClient();

  const { count: pendingCount } = await service
    .from("data_rights_requests")
    .select("id", { count: "exact", head: true })
    .eq("student_id", student.id)
    .eq("status", "PENDING");
  if ((pendingCount ?? 0) > 0) {
    return { error: "You already have a pending request — wait for it to be resolved before submitting another." };
  }

  const { error } = await service.from("data_rights_requests").insert({
    organization_id: student.organizationId,
    student_id: student.id,
    student_roll_number: student.rollNumber,
    student_full_name: student.fullName,
    request_type: requestType,
    details: details || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/student/privacy");
  return { ok: true };
}
