"use server";

import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/admin-context";
import { safeTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";

export type HallRollup = {
  hallId: string;
  buildingName: string;
  roomNumber: string;
  total: number;
  verified: number;
  wrongHall: number;
  absent: number;
  pending: number;
  flagged: number;
};

export type StudentRollupRow = {
  mappingId: string;
  hallId: string;
  rollNumber: string;
  fullName: string;
  seatNumber: string;
  status: "verified" | "wrong_hall" | "absent" | "pending";
  verifiedAt: string | null;
  flagged: boolean;
};

export type AttendanceRollup = {
  hallRollups: HallRollup[];
  studentRows: StudentRollupRow[];
};

// No scheduled job computes ABSENT — same "compute live against server time"
// approach as the reveal engine (web/src/lib/reveal.ts), rather than a cron
// that could silently stop running. A mapping counts as ABSENT once the
// exam has started and no scan has ever resolved to it (VERIFIED or
// WRONG_HALL); before that it's just PENDING.
export async function getAttendanceRollup(examId: string): Promise<AttendanceRollup> {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: exam } = await supabase
    .from("exams")
    .select("id, exam_date, start_time")
    .eq("id", examId)
    .eq("organization_id", admin.organizationId)
    .maybeSingle();
  if (!exam) return { hallRollups: [], studentRows: [] };

  const { data: mappings } = await supabase
    .from("student_exam_mappings")
    .select("id, seat_number, used_at, hall_id, halls(building_name, room_number), students(roll_number, full_name)")
    .eq("exam_id", examId);

  const mappingIds = (mappings ?? []).map((m) => m.id);
  const { data: logs } = mappingIds.length
    ? await supabase.from("verification_logs").select("mapping_id, status, verified_at").in("mapping_id", mappingIds)
    : { data: [] };

  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", admin.organizationId)
    .maybeSingle();

  const now = new Date();
  const examStarted =
    now >= zonedDateTimeToUtc(exam.exam_date, exam.start_time, safeTimeZone(org?.timezone));

  const logsByMapping = new Map<string, { status: string; verifiedAt: string }[]>();
  for (const log of logs ?? []) {
    if (!log.mapping_id) continue;
    const list = logsByMapping.get(log.mapping_id) ?? [];
    list.push({ status: log.status, verifiedAt: log.verified_at });
    logsByMapping.set(log.mapping_id, list);
  }

  const hallTotals = new Map<string, HallRollup>();
  const studentRows: StudentRollupRow[] = [];

  for (const m of mappings ?? []) {
    const hall = Array.isArray(m.halls) ? m.halls[0] : m.halls;
    const student = Array.isArray(m.students) ? m.students[0] : m.students;
    if (!hall || !student) continue;

    if (!hallTotals.has(m.hall_id)) {
      hallTotals.set(m.hall_id, {
        hallId: m.hall_id,
        buildingName: hall.building_name,
        roomNumber: hall.room_number,
        total: 0,
        verified: 0,
        wrongHall: 0,
        absent: 0,
        pending: 0,
        flagged: 0,
      });
    }
    const rollup = hallTotals.get(m.hall_id)!;
    rollup.total++;

    const mappingLogs = logsByMapping.get(m.id) ?? [];
    const isFlagged = mappingLogs.some((l) => l.status === "FLAGGED");
    const wrongHallLog = mappingLogs.find((l) => l.status === "WRONG_HALL");

    let status: StudentRollupRow["status"];
    let verifiedAt: string | null = null;
    if (m.used_at) {
      status = "verified";
      verifiedAt = m.used_at;
      rollup.verified++;
    } else if (wrongHallLog) {
      status = "wrong_hall";
      verifiedAt = wrongHallLog.verifiedAt;
      rollup.wrongHall++;
    } else if (examStarted) {
      status = "absent";
      rollup.absent++;
    } else {
      status = "pending";
      rollup.pending++;
    }
    if (isFlagged) rollup.flagged++;

    studentRows.push({
      mappingId: m.id,
      hallId: m.hall_id,
      rollNumber: student.roll_number,
      fullName: student.full_name,
      seatNumber: m.seat_number,
      status,
      verifiedAt,
      flagged: isFlagged,
    });
  }

  const hallRollups = Array.from(hallTotals.values()).sort((a, b) =>
    `${a.buildingName}${a.roomNumber}`.localeCompare(`${b.buildingName}${b.roomNumber}`),
  );

  return { hallRollups, studentRows };
}
