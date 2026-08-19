import "server-only";
import { randomBytes, createHash } from "node:crypto";

// 30 minutes: short enough to bound how long an intercepted email stays
// exploitable, long enough that a student checking their inbox a little
// late doesn't get a dead link.
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// Caps how many outstanding reset requests one student can generate in a
// window — without this, a POST to the request action with a known roll
// number becomes a free way to spam that student's real inbox, since the
// roll number + institution code pair isn't a secret (same reasoning as
// the existing login form).
export const RESET_REQUEST_WINDOW_MS = 15 * 60 * 1000;
export const RESET_REQUEST_MAX_PER_WINDOW = 3;

// The raw token lives only in the emailed link and briefly in memory here —
// what's persisted in password_reset_tokens is this hash, so a database
// leak alone can't be replayed into a working reset link.
export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("base64url");
  return { rawToken, tokenHash: hashResetToken(rawToken) };
}
