// Students log in with an institution code + roll number + password, but
// Supabase Auth identities are keyed by a single global email. We map
// (org_slug, roll_number) -> a synthetic, never-emailed address for the
// auth identity only. The real contact email used for password resets
// lives in students.email (Backend Schema doc).
//
// Roll numbers are only unique *within* an org (two institutions can both
// have "TEST101"), so the org slug has to be part of the synthetic email —
// otherwise the second org's account creation collides with the first's on
// Supabase Auth's global email uniqueness.
const STUDENT_AUTH_DOMAIN = "examguard.internal";

export function rollNumberToAuthEmail(orgSlug: string, rollNumber: string) {
  return `${rollNumber.trim().toLowerCase()}.${orgSlug.trim().toLowerCase()}@${STUDENT_AUTH_DOMAIN}`;
}

export function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
