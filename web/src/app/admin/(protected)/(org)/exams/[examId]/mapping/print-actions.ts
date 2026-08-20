"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAdmin } from "@/lib/admin-context";
import { safeTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { signStaticDisplayToken } from "@/lib/barcode-token";
import type { HallTicketExamBlock, HallTicketCustomization } from "@/components/print/hall-ticket";
import { getHallTicketCustomization } from "@/lib/hall-ticket-customization";

export type AdminHallTicket = {
  orgName: string;
  orgLogoUrl: string | null;
  customization: HallTicketCustomization | null;
  title: string;
  studentFullName: string;
  studentRollNumber: string;
  photoUrl: string | null;
  exams: HallTicketExamBlock[];
};

export type AdminHallTicketResult = { ok: false; error: string } | ({ ok: true } & AdminHallTicket);

// Admin-initiated prints skip the reveal-threshold gate entirely — that gate
// exists to keep a *student* from learning their hall/seat early, not to
// hide it from the admin who assigned it in the first place. Hall/seat is
// always shown here once mapped, and a display token is always minted
// (school orgs only, mirroring the student-side static pass) so the
// printed QR is genuinely scannable at the door.
async function buildTicketExam(
  service: ReturnType<typeof createAdminClient>,
  mapping: { id: string; seat_number: string },
  exam: {
    id: string;
    course_code: string;
    course_title: string;
    exam_date: string;
    start_time: string;
    end_time: string;
  },
  hall: { building_name: string; room_number: string } | null,
  timeZone: string,
): Promise<HallTicketExamBlock> {
  const now = new Date();
  const examEnd = zonedDateTimeToUtc(exam.exam_date, exam.end_time, timeZone);
  const completed = now.getTime() > examEnd.getTime() + 6 * 60 * 60 * 1000;
  const expiresAt = new Date(examEnd.getTime() + 6 * 60 * 60 * 1000);
  const token = completed
    ? null
    : await signStaticDisplayToken({ mappingId: mapping.id, examId: exam.id, expiresAt });

  return {
    courseCode: exam.course_code,
    courseTitle: exam.course_title,
    examDate: exam.exam_date,
    startTime: exam.start_time,
    endTime: exam.end_time,
    hall: hall ? { buildingName: hall.building_name, roomNumber: hall.room_number, seatNumber: mapping.seat_number } : null,
    displayToken: token,
    completed,
  };
}

type SchoolOrgGate =
  | { ok: false; error: string }
  | {
      ok: true;
      org: { name: string; timezone: string | null; type: string };
      orgLogoUrl: string | null;
      customization: HallTicketCustomization | null;
      service: ReturnType<typeof createAdminClient>;
    };

async function requireSchoolOrg(organizationId: string): Promise<SchoolOrgGate> {
  const service = createAdminClient();
  const { data: org } = await service
    .from("organizations")
    .select("name, timezone, type, logo_url")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org || org.type !== "SCHOOL") {
    return { ok: false, error: "Printing hall tickets on a student's behalf is only available for school organizations." };
  }

  let orgLogoUrl: string | null = null;
  if (org.logo_url) {
    const { data: signed } = await service.storage.from("org-logos").createSignedUrl(org.logo_url, 300);
    orgLogoUrl = signed?.signedUrl ?? null;
  }
  const customization = await getHallTicketCustomization(service, organizationId);

  return { ok: true, org, orgLogoUrl, customization, service };
}

// One student's ticket for a single mapping — if that mapping's exam
// belongs to a group, every exam in the group this student is mapped to is
// included too, matching the same consolidated template a school student
// gets when printing their own group pass.
export async function getAdminHallTicketForMapping(mappingId: string): Promise<AdminHallTicketResult> {
  const admin = await requireOrgAdmin();
  const gate = await requireSchoolOrg(admin.organizationId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { org, orgLogoUrl, customization, service } = gate;
  const timeZone = safeTimeZone(org.timezone);

  const { data: mapping } = await service
    .from("student_exam_mappings")
    .select(
      "id, student_id, seat_number, exams(id, course_code, course_title, exam_date, start_time, end_time, exam_group_id, organization_id), halls(building_name, room_number), students(full_name, roll_number, photo_url)",
    )
    .eq("id", mappingId)
    .maybeSingle();
  if (!mapping) return { ok: false, error: "Mapping not found." };

  const exam = Array.isArray(mapping.exams) ? mapping.exams[0] : mapping.exams;
  const student = Array.isArray(mapping.students) ? mapping.students[0] : mapping.students;
  if (!exam || exam.organization_id !== admin.organizationId || !student) {
    return { ok: false, error: "Mapping not found." };
  }
  const hall = Array.isArray(mapping.halls) ? mapping.halls[0] : mapping.halls;

  let photoUrl: string | null = null;
  if (student.photo_url) {
    const { data: signed } = await service.storage.from("student-photos").createSignedUrl(student.photo_url, 300);
    photoUrl = signed?.signedUrl ?? null;
  }

  let mappingsForTicket: Array<{
    mapping: { id: string; seat_number: string };
    exam: { id: string; course_code: string; course_title: string; exam_date: string; start_time: string; end_time: string };
    hall: { building_name: string; room_number: string } | null;
  }> = [{ mapping, exam, hall }];

  if (exam.exam_group_id) {
    const { data: groupMappings } = await service
      .from("student_exam_mappings")
      .select(
        "id, seat_number, exams!inner(id, course_code, course_title, exam_date, start_time, end_time, exam_group_id), halls(building_name, room_number)",
      )
      .eq("student_id", mapping.student_id)
      .eq("exams.exam_group_id", exam.exam_group_id);

    if (groupMappings && groupMappings.length > 0) {
      mappingsForTicket = groupMappings.map((m) => {
        const e = Array.isArray(m.exams) ? m.exams[0] : m.exams;
        const h = Array.isArray(m.halls) ? m.halls[0] : m.halls;
        return { mapping: m, exam: e!, hall: h ?? null };
      });
    }
  }

  mappingsForTicket.sort((a, b) => `${a.exam.exam_date}${a.exam.start_time}`.localeCompare(`${b.exam.exam_date}${b.exam.start_time}`));

  const exams = await Promise.all(
    mappingsForTicket.map(({ mapping: m, exam: e, hall: h }) => buildTicketExam(service, m, e, h, timeZone)),
  );

  return {
    ok: true,
    orgName: org?.name ?? "ExamGuard",
    orgLogoUrl,
    customization,
    title: exam.exam_group_id ? "Hall Ticket" : "Exam Pass",
    studentFullName: student.full_name,
    studentRollNumber: student.roll_number,
    photoUrl,
    exams,
  };
}

export type BulkHallTicketResult = { ok: false; error: string } | { ok: true; orgName: string; tickets: AdminHallTicket[] };

// One ticket per student mapped to this exam. Students sharing an exam
// group are deduplicated to a single consolidated ticket (built the same
// way as the single-mapping case above) rather than appearing once per
// exam in that group.
export async function getAdminBulkHallTickets(examId: string): Promise<BulkHallTicketResult> {
  const admin = await requireOrgAdmin();
  const gate = await requireSchoolOrg(admin.organizationId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { org, service } = gate;

  const { data: exam } = await service
    .from("exams")
    .select("id, organization_id")
    .eq("id", examId)
    .maybeSingle();
  if (!exam || exam.organization_id !== admin.organizationId) {
    return { ok: false, error: "Exam not found." };
  }

  const { data: mappings } = await service
    .from("student_exam_mappings")
    .select("id, student_id")
    .eq("exam_id", examId);

  if (!mappings || mappings.length === 0) {
    return { ok: false, error: "No students are mapped to this exam yet." };
  }

  const seenStudents = new Set<string>();
  const tickets: AdminHallTicket[] = [];
  for (const m of mappings) {
    if (seenStudents.has(m.student_id)) continue;
    seenStudents.add(m.student_id);
    const result = await getAdminHallTicketForMapping(m.id);
    if (result.ok) {
      tickets.push(result);
    }
  }

  tickets.sort((a, b) => a.studentRollNumber.localeCompare(b.studentRollNumber));

  return { ok: true, orgName: org?.name ?? "ExamGuard", tickets };
}

// Same idea as getAdminBulkHallTickets, scoped to every exam in a group
// instead of a single exam — a student mapped to more than one exam in the
// group still only gets one (consolidated) ticket, since
// getAdminHallTicketForMapping already expands to the whole group for a
// grouped exam.
export async function getAdminBulkHallTicketsForGroup(examGroupId: string): Promise<BulkHallTicketResult> {
  const admin = await requireOrgAdmin();
  const gate = await requireSchoolOrg(admin.organizationId);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { org, service } = gate;

  const { data: group } = await service
    .from("exam_groups")
    .select("id, organization_id")
    .eq("id", examGroupId)
    .maybeSingle();
  if (!group || group.organization_id !== admin.organizationId) {
    return { ok: false, error: "Exam group not found." };
  }

  const { data: groupExams } = await service.from("exams").select("id").eq("exam_group_id", examGroupId);
  const examIds = (groupExams ?? []).map((e) => e.id);
  if (examIds.length === 0) {
    return { ok: false, error: "No exams in this group yet." };
  }

  const { data: mappings } = await service
    .from("student_exam_mappings")
    .select("id, student_id")
    .in("exam_id", examIds);

  if (!mappings || mappings.length === 0) {
    return { ok: false, error: "No students are mapped to this group yet." };
  }

  const seenStudents = new Set<string>();
  const tickets: AdminHallTicket[] = [];
  for (const m of mappings) {
    if (seenStudents.has(m.student_id)) continue;
    seenStudents.add(m.student_id);
    const result = await getAdminHallTicketForMapping(m.id);
    if (result.ok) {
      tickets.push(result);
    }
  }

  tickets.sort((a, b) => a.studentRollNumber.localeCompare(b.studentRollNumber));

  return { ok: true, orgName: org?.name ?? "ExamGuard", tickets };
}
