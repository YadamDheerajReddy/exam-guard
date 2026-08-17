import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInvigilator, UnauthorizedError } from "@/lib/invigilator-context";

// Signed photo URLs need to outlive the whole exam window on a device that
// may go offline right after pre-sync — matches the +6h buffer the base
// barcode_token already uses for the same reason.
const PHOTO_SIGNED_URL_TTL_SECONDS = 6 * 60 * 60;

export async function GET(request: Request) {
  let invigilator;
  try {
    invigilator = await requireInvigilator(request);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }

  if (!invigilator.assignedHallId) {
    return NextResponse.json({ error: "No hall assigned." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("examId");
  if (!examId) {
    return NextResponse.json({ error: "examId is required." }, { status: 400 });
  }

  const service = createAdminClient();

  const [{ data: exam }, { data: mappings }] = await Promise.all([
    service
      .from("exams")
      .select("id, course_code, course_title, exam_date, start_time, end_time")
      .eq("id", examId)
      .maybeSingle(),
    // Every hall for this exam, not just the invigilator's own — a scan
    // that resolves to a different hall still needs to render a "Correct
    // Hall: Block B, Room 214" redirect card fully offline (UI/UX Brief
    // §5), which means the device has to already know where that student
    // actually belongs before it can say so.
    service
      .from("student_exam_mappings")
      .select(
        "id, seat_number, used_at, hall_id, halls(building_name, room_number), students(roll_number, full_name, department, photo_url)",
      )
      .eq("exam_id", examId),
  ]);

  if (!exam) {
    return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  }

  const photoPaths = (mappings ?? [])
    .map((m) => {
      const student = Array.isArray(m.students) ? m.students[0] : m.students;
      return student?.photo_url;
    })
    .filter((p): p is string => Boolean(p));

  const signedUrlByPath = new Map<string, string>();
  if (photoPaths.length > 0) {
    const { data: signed } = await service.storage
      .from("student-photos")
      .createSignedUrls(photoPaths, PHOTO_SIGNED_URL_TTL_SECONDS);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) signedUrlByPath.set(s.path, s.signedUrl);
    }
  }

  const roster = (mappings ?? []).map((m) => {
    const student = Array.isArray(m.students) ? m.students[0] : m.students;
    const hall = Array.isArray(m.halls) ? m.halls[0] : m.halls;
    return {
      mappingId: m.id,
      rollNumber: student?.roll_number ?? "",
      fullName: student?.full_name ?? "",
      department: student?.department ?? "",
      seatNumber: m.seat_number,
      usedAt: m.used_at,
      hallId: m.hall_id,
      hallBuildingName: hall?.building_name ?? "",
      hallRoomNumber: hall?.room_number ?? "",
      photoUrl: student?.photo_url ? (signedUrlByPath.get(student.photo_url) ?? null) : null,
    };
  });

  return NextResponse.json({
    exam: {
      id: exam.id,
      courseCode: exam.course_code,
      courseTitle: exam.course_title,
      examDate: exam.exam_date,
      startTime: exam.start_time,
      endTime: exam.end_time,
    },
    myHallId: invigilator.assignedHallId,
    roster,
  });
}
