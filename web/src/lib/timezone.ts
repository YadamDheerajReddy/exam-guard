// Exams are stored as a plain `date` + `time` pair — a *wall-clock* time at
// the institution ("the exam starts at 09:00"), with no offset attached.
// `new Date("2026-08-20T09:00:00")` resolves that against whatever timezone
// the *server process* happens to run in, which on Vercel is UTC. For an
// institution in IST that silently shifts every reveal by 5.5 hours, so all
// exam timing goes through here instead, anchored to the org's own zone.

// How far ahead of UTC the given zone is at the given instant, in ms.
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    // Some engines render midnight as hour "24" under hour12:false.
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - instant.getTime();
}

// Resolves a wall-clock date + time in `timeZone` to the real UTC instant.
export function zonedDateTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const naive = Date.parse(`${dateStr}T${time}Z`);
  if (Number.isNaN(naive)) return new Date(NaN);

  // Two passes: the offset in effect at the *guessed* instant can differ
  // from the one at the naive instant when the wall-clock time sits near a
  // DST transition. The second pass re-resolves against the corrected
  // instant. (India has no DST, but other zones do.)
  const firstPass = naive - zoneOffsetMs(new Date(naive), timeZone);
  return new Date(naive - zoneOffsetMs(new Date(firstPass), timeZone));
}

// Offered when onboarding an organization. A curated list rather than the
// full IANA set: an admin picking their institution's zone doesn't need 400
// options, and a closed list is trivially validatable on the server.
export const COMMON_TIME_ZONES = [
  "Asia/Kolkata",
  "Asia/Colombo",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
] as const;

export type CommonTimeZone = (typeof COMMON_TIME_ZONES)[number];

export function isCommonTimeZone(value: string): value is CommonTimeZone {
  return (COMMON_TIME_ZONES as readonly string[]).includes(value);
}

// Guards against a bad/unknown IANA name reaching Intl and throwing on a
// request path — falls back to UTC rather than 500-ing the page.
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}
