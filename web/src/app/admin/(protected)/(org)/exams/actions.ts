"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/admin-context";

export type ExamFormState = { error?: string } | undefined;

export async function createExam(
  _prevState: ExamFormState,
  formData: FormData,
): Promise<ExamFormState> {
  const courseCode = String(formData.get("courseCode") ?? "").trim();
  const courseTitle = String(formData.get("courseTitle") ?? "").trim();
  const examDate = String(formData.get("examDate") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const revealThresholdMinutes = Number(formData.get("revealThresholdMinutes"));

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

  const admin = await requireOrgAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("exams").insert({
    course_code: courseCode,
    course_title: courseTitle,
    exam_date: examDate,
    start_time: startTime,
    end_time: endTime,
    reveal_threshold_minutes: revealThresholdMinutes,
    organization_id: admin.organizationId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/exams");
  revalidatePath("/admin");
  return undefined;
}
