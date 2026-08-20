"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/admin-context";
import { signBarcodeToken } from "@/lib/barcode-token";
import { safeTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";

export type ExamFormState = { error?: string } | undefined;

type ParsedExam = {
  courseCode: string;
  courseTitle: string;
  examDate: string;
  startTime: string;
  endTime: string;
  revealThresholdMinutes: number;
  examGroupId: string | null;
};

function parseExamForm(formData: FormData): ParsedExam | { error: string } {
  const courseCode = String(formData.get("courseCode") ?? "").trim();
  const courseTitle = String(formData.get("courseTitle") ?? "").trim();
  const examDate = String(formData.get("examDate") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const revealThresholdMinutes = Number(formData.get("revealThresholdMinutes"));
  const examGroupId = String(formData.get("examGroupId") ?? "").trim() || null;

  if (!courseCode || !courseTitle) {
    return { error: "Course code and title are required." };
  }
  if (!examDate) {
    return { error: "Exam date is required." };
  }
  if (!startTime || !endTime) {
    return { error: "Start and end time are required." };
  }
  if (endTime <= startTime) {
    return { error: "End time must be after start time." };
  }
  if (!Number.isFinite(revealThresholdMinutes) || revealThresholdMinutes < 0) {
    return { error: "Reveal threshold must be a non-negative number of minutes." };
  }

  return { courseCode, courseTitle, examDate, startTime, endTime, revealThresholdMinutes, examGroupId };
}

// examGroupId is client-supplied — confirm it's actually one of this
// admin's own groups before it ever reaches an insert/update, otherwise an
// org could point an exam at another org's group id.
async function verifyExamGroupOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  examGroupId: string | null,
  organizationId: string,
): Promise<{ error: string } | null> {
  if (!examGroupId) return null;
  const { data } = await supabase
    .from("exam_groups")
    .select("id")
    .eq("id", examGroupId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data ? null : { error: "That exam group could not be found." };
}

export async function createExam(
  _prevState: ExamFormState,
  formData: FormData,
): Promise<ExamFormState> {
  const parsed = parseExamForm(formData);
  if ("error" in parsed) return parsed;

  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const ownershipError = await verifyExamGroupOwnership(supabase, parsed.examGroupId, admin.organizationId);
  if (ownershipError) return ownershipError;

  const { error } = await supabase.from("exams").insert({
    course_code: parsed.courseCode,
    course_title: parsed.courseTitle,
    exam_date: parsed.examDate,
    start_time: parsed.startTime,
    end_time: parsed.endTime,
    reveal_threshold_minutes: parsed.revealThresholdMinutes,
    organization_id: admin.organizationId,
    exam_group_id: parsed.examGroupId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/exams");
  revalidatePath("/admin");
  return undefined;
}

export async function updateExam(
  examId: string,
  _prevState: ExamFormState,
  formData: FormData,
): Promise<ExamFormState> {
  const parsed = parseExamForm(formData);
  if ("error" in parsed) return parsed;

  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("exams")
    .select("exam_date, end_time, organizations(timezone)")
    .eq("id", examId)
    .eq("organization_id", admin.organizationId)
    .maybeSingle();
  if (!existing) return { error: "Exam not found." };

  const ownershipError = await verifyExamGroupOwnership(supabase, parsed.examGroupId, admin.organizationId);
  if (ownershipError) return ownershipError;

  const { error } = await supabase
    .from("exams")
    .update({
      course_code: parsed.courseCode,
      course_title: parsed.courseTitle,
      exam_date: parsed.examDate,
      start_time: parsed.startTime,
      end_time: parsed.endTime,
      reveal_threshold_minutes: parsed.revealThresholdMinutes,
      exam_group_id: parsed.examGroupId,
    })
    .eq("id", examId)
    .eq("organization_id", admin.organizationId);

  if (error) return { error: error.message };

  // Barcodes are signed with an expiry derived from the exam's end — so
  // moving an exam later (the whole point of fixing a typo'd date) would
  // otherwise leave every already-issued pass expiring at the *old* time
  // and failing silently at the hall door. Re-sign them to match.
  if (existing.exam_date !== parsed.examDate || existing.end_time !== parsed.endTime) {
    const org = Array.isArray(existing.organizations) ? existing.organizations[0] : existing.organizations;
    const newExpiry = new Date(
      zonedDateTimeToUtc(parsed.examDate, parsed.endTime, safeTimeZone(org?.timezone)).getTime() +
        6 * 60 * 60 * 1000,
    );

    const { data: mappings } = await supabase
      .from("student_exam_mappings")
      .select("id")
      .eq("exam_id", examId);

    for (const mapping of mappings ?? []) {
      const token = await signBarcodeToken({ mappingId: mapping.id, examId, expiresAt: newExpiry });
      await supabase.from("student_exam_mappings").update({ barcode_token: token }).eq("id", mapping.id);
    }
  }

  revalidatePath("/admin/exams");
  revalidatePath("/admin");
  revalidatePath("/student");
  return undefined;
}

export async function deleteExam(examId: string): Promise<{ error?: string }> {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: mappings } = await supabase
    .from("student_exam_mappings")
    .select("id")
    .eq("exam_id", examId);
  const mappingIds = (mappings ?? []).map((m) => m.id);

  // Deleting an exam cascades to its mappings, and verification_logs point
  // at those mappings with no ON DELETE rule — so this would either fail on
  // a foreign key or, worse, take scan history with it. The audit trail is
  // append-only and legally meaningful, so refuse instead.
  if (mappingIds.length > 0) {
    const { count } = await supabase
      .from("verification_logs")
      .select("id", { count: "exact", head: true })
      .in("mapping_id", mappingIds);

    if (count && count > 0) {
      return {
        error: `Can't delete — ${count} verification ${count === 1 ? "scan has" : "scans have"} been recorded against this exam. Deleting it would destroy that audit trail.`,
      };
    }
  }

  const { error } = await supabase
    .from("exams")
    .delete()
    .eq("id", examId)
    .eq("organization_id", admin.organizationId);
  if (error) return { error: error.message };

  revalidatePath("/admin/exams");
  revalidatePath("/admin");
  return {};
}

export type ExamGroupFormState = { error?: string } | undefined;

// Groups exist purely to organize exams under a common label ("Mid-term
// Exams") — no exam is required to belong to one. Deletion/rename aren't
// offered yet; an exam already assigned to a group just stays assigned.
export async function createExamGroup(
  _prevState: ExamGroupFormState,
  formData: FormData,
): Promise<ExamGroupFormState> {
  const admin = await requireOrgAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Group name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("exam_groups").insert({
    name,
    organization_id: admin.organizationId,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/exams");
  return undefined;
}
