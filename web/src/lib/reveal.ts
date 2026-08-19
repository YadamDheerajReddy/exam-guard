import { zonedDateTimeToUtc } from "@/lib/timezone";

// Server-authoritative reveal timing (TRD §3: "client clocks are never
// trusted for security-relevant timing"). Pure function — callers pass in
// `now` themselves (from `new Date()` at the call site) so this stays
// testable and isn't itself flagged as an impure render call.
//
// `timeZone` is the *organization's* IANA zone. exam_date/start_time/end_time
// are wall-clock values at the institution, so they can only be resolved to
// real instants against that zone — never the server's own (see timezone.ts).
export function computeRevealState(
  now: Date,
  examDate: string,
  startTime: string,
  endTime: string,
  thresholdMinutes: number,
  timeZone: string,
) {
  const start = zonedDateTimeToUtc(examDate, startTime, timeZone);
  const end = zonedDateTimeToUtc(examDate, endTime, timeZone);
  const revealAt = new Date(start.getTime() - thresholdMinutes * 60_000);

  return {
    revealed: now >= revealAt,
    completed: now >= end,
    revealAt,
    examStart: start,
    examEnd: end,
  };
}

export type ExamStatus = "upcoming" | "pass-ready" | "completed";

export function examStatus(
  now: Date,
  examDate: string,
  startTime: string,
  endTime: string,
  thresholdMinutes: number,
  timeZone: string,
): ExamStatus {
  const state = computeRevealState(now, examDate, startTime, endTime, thresholdMinutes, timeZone);
  if (state.completed) return "completed";
  if (state.revealed) return "pass-ready";
  return "upcoming";
}
