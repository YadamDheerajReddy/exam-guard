import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInvigilator, UnauthorizedError } from "@/lib/invigilator-context";

type ExamRow = {
  id: string;
  course_code: string;
  course_title: string;
  exam_date: string;
  start_time: string;
  end_time: string;
};

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
    return NextResponse.json({ exams: [] });
  }

  const service = createAdminClient();
  const { data: mappings } = await service
    .from("student_exam_mappings")
    .select("exam_id, exams(id, course_code, course_title, exam_date, start_time, end_time)")
    .eq("hall_id", invigilator.assignedHallId);

  const examsById = new Map<string, ExamRow>();
  for (const m of mappings ?? []) {
    const exam = Array.isArray(m.exams) ? m.exams[0] : m.exams;
    if (exam && !examsById.has(exam.id)) {
      examsById.set(exam.id, exam);
    }
  }

  const exams = Array.from(examsById.values())
    .sort((a, b) => `${a.exam_date}${a.start_time}`.localeCompare(`${b.exam_date}${b.start_time}`))
    .map((e) => ({
      id: e.id,
      courseCode: e.course_code,
      courseTitle: e.course_title,
      examDate: e.exam_date,
      startTime: e.start_time,
      endTime: e.end_time,
    }));

  return NextResponse.json({ exams });
}
