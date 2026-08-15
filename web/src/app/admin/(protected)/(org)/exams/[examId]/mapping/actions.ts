"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { signBarcodeToken } from "@/lib/barcode-token";

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
    .select("id, exam_date, end_time")
    .eq("id", examId)
    .maybeSingle();

  if (examError || !exam) {
    return assignments.map((a) => ({
      studentId: a.studentId,
      ok: false,
      error: "Exam not found.",
    }));
  }

  // Base token stays valid through the exam window plus a buffer for
  // clock skew / late finishes, distinct from the rotating short-lived
  // display token the student portal issues in Phase 2.
  const expiresAt = new Date(`${exam.exam_date}T${exam.end_time}`);
  expiresAt.setHours(expiresAt.getHours() + 6);

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
