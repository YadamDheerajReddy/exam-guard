// Students log in with a roll number + password (FR-9), but Supabase Auth
// identities are keyed by email. We map roll_number -> a synthetic,
// never-emailed address for the auth identity only. The real contact email
// used for password resets lives in students.email (Backend Schema doc).
const STUDENT_AUTH_DOMAIN = "examguard.internal";

export function rollNumberToAuthEmail(rollNumber: string) {
  return `${rollNumber.trim().toLowerCase()}@${STUDENT_AUTH_DOMAIN}`;
}
