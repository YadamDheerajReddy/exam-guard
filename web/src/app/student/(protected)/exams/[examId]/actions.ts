"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudent } from "@/lib/student-context";
import { computeRevealState } from "@/lib/reveal";
import { safeTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { signRotatingDisplayToken, signStaticDisplayToken } from "@/lib/barcode-token";

export type ExamPassResult =
  | { ok: false; error: string }
  | {
      ok: true;
      courseCode: string;
      courseTitle: string;
      examDate: string;
      startTime: string;
      endTime: string;
      revealAt: string;
      revealed: boolean;
      completed: boolean;
      checkedIn: boolean;
      checkedInAt: string | null;
      hall: { buildingName: string; roomNumber: string; seatNumber: string; capacity: number } | null;
      photoUrl: string | null;
      studentFullName: string;
      studentRollNumber: string;
      // School students often have no phone to hold a live rotating code
      // steady at the door — for them this pass is a single QR meant to be
      // printed, not refreshed. displayTokenExpiresAt is still meaningful
      // (through the exam window, not 90s) but the UI shouldn't show a
      // countdown ring for it.
      isStaticPass: boolean;
      // Null once the exam window has closed — see the minting guard below.
      displayToken: string | null;
      displayTokenExpiresAt: string | null;
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
      "id, seat_number, used_at, exams(course_code, course_title, exam_date, start_time, end_time, reveal_threshold_minutes), halls(building_name, room_number, capacity)",
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

  const { data: org } = await service
    .from("organizations")
    .select("timezone, type")
    .eq("id", student.organizationId)
    .maybeSingle();
  const timeZone = safeTimeZone(org?.timezone);
  const isSchool = org?.type === "SCHOOL";

  const now = new Date();
  const state = computeRevealState(
    now,
    exam.exam_date,
    exam.start_time,
    exam.end_time,
    exam.reveal_threshold_minutes,
    timeZone,
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

  // Once the exam window closes the pass is spent, so stop minting display
  // tokens entirely rather than just hiding the QR client-side — otherwise
  // a still-valid token sits in the network response of any stale tab and
  // could be re-rendered into a scannable code.
  let token: string | null = null;
  let expiresAt: Date | null = null;
  if (!state.completed) {
    if (isSchool) {
      const examEnd = zonedDateTimeToUtc(exam.exam_date, exam.end_time, timeZone);
      expiresAt = new Date(examEnd.getTime() + 6 * 60 * 60 * 1000);
      token = await signStaticDisplayToken({ mappingId: mapping.id, examId, expiresAt });
    } else {
      const signed = await signRotatingDisplayToken({ mappingId: mapping.id, examId });
      token = signed.token;
      expiresAt = signed.expiresAt;
    }
  }

  return {
    ok: true,
    courseCode: exam.course_code,
    courseTitle: exam.course_title,
    examDate: exam.exam_date,
    startTime: exam.start_time,
    endTime: exam.end_time,
    revealAt: state.revealAt.toISOString(),
    revealed: state.revealed,
    completed: state.completed,
    checkedIn: mapping.used_at !== null,
    checkedInAt: mapping.used_at,
    hall:
      state.revealed && hall
        ? {
            buildingName: hall.building_name,
            roomNumber: hall.room_number,
            seatNumber: mapping.seat_number,
            capacity: hall.capacity,
          }
        : null,
    photoUrl,
    studentFullName: student.fullName,
    studentRollNumber: student.rollNumber,
    isStaticPass: isSchool,
    displayToken: token,
    displayTokenExpiresAt: expiresAt?.toISOString() ?? null,
  };
}
