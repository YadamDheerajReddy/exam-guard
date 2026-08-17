"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudent } from "@/lib/student-context";
import { computeRevealState } from "@/lib/reveal";
import { signRotatingDisplayToken } from "@/lib/barcode-token";

export type ExamPassResult =
  | { ok: false; error: string }
  | {
      ok: true;
      courseCode: string;
      courseTitle: string;
      examDate: string;
      startTime: string;
      revealAt: string;
      revealed: boolean;
      checkedIn: boolean;
      checkedInAt: string | null;
      hall: { buildingName: string; roomNumber: string; seatNumber: string } | null;
      photoUrl: string | null;
      displayToken: string;
      displayTokenExpiresAt: string;
    };

// Every field the student client sees comes from this one server action —
// hall/seat are only included in the returned object once `revealed` is
// true, computed server-side against the exam's own start_time. There's no
// RLS grant on student_exam_mappings for students at all (TRD §3: hall/
// seat withheld server-side, not just UI-hidden — a direct table grant
// would let a browser dev-tools query pull those fields early regardless
// of what this action redacts).
export async function getExamPass(examId: string): Promise<ExamPassResult> {
  const student = await requireStudent();
  const service = createAdminClient();

  const { data: mapping } = await service
    .from("student_exam_mappings")
    .select(
      "id, seat_number, used_at, exams(course_code, course_title, exam_date, start_time, end_time, reveal_threshold_minutes), halls(building_name, room_number)",
    )
    .eq("student_id", student.id)
    .eq("exam_id", examId)
    .maybeSingle();

  if (!mapping) {
    return { ok: false, error: "No pass found for this exam." };
  }

  const exam = Array.isArray(mapping.exams) ? mapping.exams[0] : mapping.exams;
  if (!exam) {
    return { ok: false, error: "Exam not found." };
  }
  const hall = Array.isArray(mapping.halls) ? mapping.halls[0] : mapping.halls;

  const now = new Date();
  const state = computeRevealState(
    now,
    exam.exam_date,
    exam.start_time,
    exam.end_time,
    exam.reveal_threshold_minutes,
  );

  const { data: studentRow } = await service
    .from("students")
    .select("photo_url")
    .eq("id", student.id)
    .maybeSingle();

  let photoUrl: string | null = null;
  if (studentRow?.photo_url) {
    const { data: signed } = await service.storage
      .from("student-photos")
      .createSignedUrl(studentRow.photo_url, 300);
    photoUrl = signed?.signedUrl ?? null;
  }

  const { token, expiresAt } = await signRotatingDisplayToken({
    mappingId: mapping.id,
    examId,
  });

  return {
    ok: true,
    courseCode: exam.course_code,
    courseTitle: exam.course_title,
    examDate: exam.exam_date,
    startTime: exam.start_time,
    revealAt: state.revealAt.toISOString(),
    revealed: state.revealed,
    checkedIn: mapping.used_at !== null,
    checkedInAt: mapping.used_at,
    hall:
      state.revealed && hall
        ? {
            buildingName: hall.building_name,
            roomNumber: hall.room_number,
            seatNumber: mapping.seat_number,
          }
        : null,
    photoUrl,
    displayToken: token,
    displayTokenExpiresAt: expiresAt.toISOString(),
  };
}
