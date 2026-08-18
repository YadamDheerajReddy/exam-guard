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

// Invigilators get a deterministic temp password too ({organizationName
// with spaces stripped}@#{organizationSlug}), mirroring the student temp
// password below — spaces are stripped so the password is a single
// copy-pasteable token instead of something that silently fails if a
// student/invigilator (or an admin retyping it) collapses whitespace
// differently than it was generated.
export function invigilatorTempPassword(orgName: string, orgSlug: string) {
  return `${orgName.replace(/\s+/g, "")}@#${orgSlug}`;
}

export function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A few reasonable candidates for an org admin picking their own
// Organization ID on first login — full name, initials, first word, and a
// short prefix. Caller filters out ones already taken.
export function suggestOrganizationIds(name: string): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const candidates = new Set<string>();

  const full = slugify(name);
  if (full) candidates.add(full);

  if (words.length > 1) {
    const acronym = words
      .map((w) => w[0])
      .join("")
      .toLowerCase();
    if (acronym.length >= 2) candidates.add(acronym);
  }

  const firstWord = slugify(words[0] ?? "");
  if (firstWord && firstWord !== full) candidates.add(firstWord);

  if (full.length > 10) {
    const short = full.slice(0, 10).replace(/-+$/, "");
    if (short) candidates.add(short);
  }

  return Array.from(candidates).filter(Boolean);
}
