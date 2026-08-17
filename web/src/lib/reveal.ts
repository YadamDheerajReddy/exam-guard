// Server-authoritative reveal timing (TRD §3: "client clocks are never
// trusted for security-relevant timing"). Pure function — callers pass in
// `now` themselves (from `new Date()` at the call site) so this stays
// testable and isn't itself flagged as an impure render call.
export function computeRevealState(
  now: Date,
  examDate: string,
  startTime: string,
  endTime: string,
  thresholdMinutes: number,
) {
  const start = new Date(`${examDate}T${startTime}`);
  const end = new Date(`${examDate}T${endTime}`);
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
): ExamStatus {
  const state = computeRevealState(now, examDate, startTime, endTime, thresholdMinutes);
  if (state.completed) return "completed";
  if (state.revealed) return "pass-ready";
  return "upcoming";
}
