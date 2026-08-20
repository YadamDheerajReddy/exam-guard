"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudent } from "@/lib/student-context";
import { computeRevealState } from "@/lib/reveal";
import { safeTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { signStaticDisplayToken } from "@/lib/barcode-token";

export type ExamGroupPassResult =
  | { ok: false; error: string }
  | {
      ok: true;
      groupName: string;
      studentFullName: string;
      studentRollNumber: string;
      photoUrl: string | null;
      exams: Array<{
        examId: string;
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
        displayToken: string | null;
        displayTokenExpiresAt: string | null;
      }>;
    };

// School-only consolidated version of getExamPass (see exams/[examId]/actions.ts) —
// mirrors the same per-exam reveal/token logic, once per exam in the group,
// rather than reaching for a shared abstraction across two call sites this
// small. Every field is still gated the same way: hall/seat only once
// revealed, no token minted once an exam's window has closed.
export async function getExamGroupPass(groupId: string): Promise<ExamGroupPassResult> {
  const student = await requireStudent();
  const service = createAdminClient();

  const { data: group } = await service
    .from("exam_groups")
    .select("id, name, organization_id")
    .eq("id", groupId)
    .maybeSingle();
  if (!group || group.organization_id !== student.organizationId) {
    return { ok: false, error: "Exam group not found." };
  }

  const { data: org } = await service
    .from("organizations")
    .select("timezone, type")
    .eq("id", student.organizationId)
    .maybeSingle();
  if (org?.type !== "SCHOOL") {
    return { ok: false, error: "Consolidated exam group passes are only available for school organizations." };
  }
  const timeZone = safeTimeZone(org?.timezone);

  const { data: mappings } = await service
    .from("student_exam_mappings")
    .select(
      "id, exam_id, seat_number, used_at, exams!inner(course_code, course_title, exam_date, start_time, end_time, reveal_threshold_minutes, exam_group_id), halls(building_name, room_number, capacity)",
    )
    .eq("student_id", student.id)
    .eq("exams.exam_group_id", groupId);

  if (!mappings || mappings.length === 0) {
    return { ok: false, error: "No exams found for you in this group." };
  }

  const { data: studentRow } = await service.from("students").select("photo_url").eq("id", student.id).maybeSingle();
  let photoUrl: string | null = null;
  if (studentRow?.photo_url) {
    const { data: signed } = await service.storage
      .from("student-photos")
      .createSignedUrl(studentRow.photo_url, 300);
    photoUrl = signed?.signedUrl ?? null;
  }

  const now = new Date();
  const exams: NonNullable<Extract<ExamGroupPassResult, { ok: true }>>["exams"] = [];

  for (const mapping of mappings) {
    const exam = Array.isArray(mapping.exams) ? mapping.exams[0] : mapping.exams;
    if (!exam) continue;
    const hall = Array.isArray(mapping.halls) ? mapping.halls[0] : mapping.halls;

    const state = computeRevealState(
      now,
      exam.exam_date,
      exam.start_time,
      exam.end_time,
      exam.reveal_threshold_minutes,
      timeZone,
    );

    let token: string | null = null;
    let expiresAt: Date | null = null;
    if (!state.completed) {
      const examEnd = zonedDateTimeToUtc(exam.exam_date, exam.end_time, timeZone);
      expiresAt = new Date(examEnd.getTime() + 6 * 60 * 60 * 1000);
      token = await signStaticDisplayToken({ mappingId: mapping.id, examId: mapping.exam_id, expiresAt });
    }

    exams.push({
      examId: mapping.exam_id,
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
      displayToken: token,
      displayTokenExpiresAt: expiresAt?.toISOString() ?? null,
    });
  }

  exams.sort((a, b) => `${a.examDate}${a.startTime}`.localeCompare(`${b.examDate}${b.startTime}`));

  return {
    ok: true,
    groupName: group.name,
    studentFullName: student.fullName,
    studentRollNumber: student.rollNumber,
    photoUrl,
    exams,
  };
}
