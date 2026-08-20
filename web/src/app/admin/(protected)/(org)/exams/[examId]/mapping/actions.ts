"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { signBarcodeToken } from "@/lib/barcode-token";
import { safeTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";

export type MappingAssignment = {
  studentId: string;
  hallId: string;
  seatNumber: string;
};

export type MappingResult = {
  studentId: string;
  ok: boolean;
  error?: string;
};

export async function createMappings(
  examId: string,
  assignments: MappingAssignment[],
): Promise<MappingResult[]> {
  const supabase = await createClient();

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, exam_date, end_time, organizations(timezone)")
    .eq("id", examId)
    .maybeSingle();

  if (examError || !exam) {
    return assignments.map((a) => ({
      studentId: a.studentId,
      ok: false,
      error: "Exam not found.",
    }));
  }

  const examOrg = Array.isArray(exam.organizations) ? exam.organizations[0] : exam.organizations;

  // Base token stays valid through the exam window plus a buffer for
  // clock skew / late finishes, distinct from the rotating short-lived
  // display token the student portal issues in Phase 2. The end time is a
  // wall-clock value at the institution, so it resolves against the org's
  // zone — not the server's.
  const examEnd = zonedDateTimeToUtc(exam.exam_date, exam.end_time, safeTimeZone(examOrg?.timezone));
  const expiresAt = new Date(examEnd.getTime() + 6 * 60 * 60 * 1000);

  const results: MappingResult[] = [];

  for (const assignment of assignments) {
    const seatNumber = assignment.seatNumber.trim();
    if (!seatNumber) {
      results.push({ studentId: assignment.studentId, ok: false, error: "Missing seat number." });
      continue;
    }

    const mappingId = randomUUID();
    const barcodeToken = await signBarcodeToken({
      mappingId,
      examId,
      expiresAt,
    });

    const { error } = await supabase.from("student_exam_mappings").insert({
      id: mappingId,
      student_id: assignment.studentId,
      exam_id: examId,
      hall_id: assignment.hallId,
      seat_number: seatNumber,
      barcode_token: barcodeToken,
    });

    if (error) {
      const message =
        error.code === "23505"
          ? "Seat already taken, or this student is already mapped to this exam."
          : error.message;
      results.push({ studentId: assignment.studentId, ok: false, error: message });
      continue;
    }

    results.push({ studentId: assignment.studentId, ok: true });
  }

  revalidatePath(`/admin/exams/${examId}/mapping`);
  revalidatePath("/admin");
  return results;
}

export type GroupMappingRowResult = {
  examId: string;
  courseCode: string;
  ok: boolean;
  error?: string;
};
export type GroupMappingResult = {
  studentId: string;
  results: GroupMappingRowResult[];
};

// Same per-row insert as createMappings above, just repeated once per exam
// in the group with the same hall/seat — a grouped exam series (e.g.
// "Mid-term Exams") is normally one physical seat per student across every
// paper in it, so mapping the group is mapping every exam in it in one
// pass rather than a separate trip to each exam's own mapping page. The
// student_exam_mappings(student_id, exam_id) unique constraint means a
// student already mapped to one exam in the group just fails gracefully
// on that row (reported per-exam below) while the rest still go through —
// including retries, which re-attempt already-succeeded exams too and get
// the same harmless "already mapped" outcome for those.
export async function createGroupMappings(
  examGroupId: string,
  assignments: MappingAssignment[],
): Promise<GroupMappingResult[]> {
  const supabase = await createClient();

  const { data: exams } = await supabase
    .from("exams")
    .select("id, course_code, exam_date, end_time, organizations(timezone)")
    .eq("exam_group_id", examGroupId)
    .order("exam_date", { ascending: true });

  if (!exams || exams.length === 0) {
    return assignments.map((a) => ({
      studentId: a.studentId,
      results: [{ examId: "", courseCode: "", ok: false, error: "Exam group not found." }],
    }));
  }

  const results: GroupMappingResult[] = [];

  for (const assignment of assignments) {
    const seatNumber = assignment.seatNumber.trim();
    const rowResults: GroupMappingRowResult[] = [];

    if (!seatNumber) {
      for (const exam of exams) {
        rowResults.push({ examId: exam.id, courseCode: exam.course_code, ok: false, error: "Missing seat number." });
      }
      results.push({ studentId: assignment.studentId, results: rowResults });
      continue;
    }

    for (const exam of exams) {
      const examOrg = Array.isArray(exam.organizations) ? exam.organizations[0] : exam.organizations;
      const examEnd = zonedDateTimeToUtc(exam.exam_date, exam.end_time, safeTimeZone(examOrg?.timezone));
      const expiresAt = new Date(examEnd.getTime() + 6 * 60 * 60 * 1000);

      const mappingId = randomUUID();
      const barcodeToken = await signBarcodeToken({ mappingId, examId: exam.id, expiresAt });

      const { error } = await supabase.from("student_exam_mappings").insert({
        id: mappingId,
        student_id: assignment.studentId,
        exam_id: exam.id,
        hall_id: assignment.hallId,
        seat_number: seatNumber,
        barcode_token: barcodeToken,
      });

      if (error) {
        const message =
          error.code === "23505"
            ? "Seat already taken, or this student is already mapped to this exam."
            : error.message;
        rowResults.push({ examId: exam.id, courseCode: exam.course_code, ok: false, error: message });
        continue;
      }

      rowResults.push({ examId: exam.id, courseCode: exam.course_code, ok: true });
    }

    results.push({ studentId: assignment.studentId, results: rowResults });
  }

  for (const exam of exams) {
    revalidatePath(`/admin/exams/${exam.id}/mapping`);
  }
  revalidatePath("/admin/exams");
  revalidatePath("/admin");
  return results;
}
