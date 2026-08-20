// Shared between the client-side upload preview and the server action's
// re-validation pass, so both agree on what counts as a valid row.
export type RosterRow = {
  rollNumber: string;
  fullName: string;
  email: string;
  department: string;
  photoUrl: string;
};

export type ValidatedRosterRow = RosterRow & {
  error: string | null;
};

const HEADER_ALIASES: Record<string, keyof RosterRow> = {
  roll_number: "rollNumber",
  rollnumber: "rollNumber",
  "roll number": "rollNumber",
  roll: "rollNumber",
  full_name: "fullName",
  fullname: "fullName",
  name: "fullName",
  email: "email",
  department: "department",
  dept: "department",
  // Schools track a class/grade in this same column rather than a
  // department — accepted as aliases regardless of org type so a school's
  // own CSV export (which is unlikely to say "department") still parses.
  class: "department",
  grade: "department",
  "class/grade": "department",
  photo_url: "photoUrl",
  photourl: "photoUrl",
  photo: "photoUrl",
};

export function normalizeHeader(header: string): keyof RosterRow | null {
  return HEADER_ALIASES[header.trim().toLowerCase()] ?? null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// emailRequired is false for school orgs — many school students have no
// email at all. When it's not required, a blank email is fine, but a
// *non-blank* one is still format-checked and deduped — an admin who does
// type something wrong still needs to hear about it.
export function validateRosterRows(
  rows: RosterRow[],
  fieldLabel = "department",
  emailRequired = true,
): ValidatedRosterRow[] {
  const rollSeen = new Set<string>();
  const emailSeen = new Set<string>();

  return rows.map((row) => {
    const rollNumber = row.rollNumber.trim();
    const fullName = row.fullName.trim();
    const email = row.email.trim().toLowerCase();
    const department = row.department.trim();
    const photoUrl = row.photoUrl.trim();

    let error: string | null = null;
    if (!rollNumber) error = "Missing roll number.";
    else if (!fullName) error = "Missing name.";
    else if (emailRequired && !email) error = "Missing email.";
    else if (email && !EMAIL_RE.test(email)) error = "Invalid email format.";
    else if (!department) error = `Missing ${fieldLabel}.`;
    else if (rollSeen.has(rollNumber)) {
      error = "Duplicate roll number in this list.";
    } else if (email && emailSeen.has(email)) {
      error = "Duplicate email in this list.";
    }

    if (!error) {
      rollSeen.add(rollNumber);
      if (email) emailSeen.add(email);
    }

    return { rollNumber, fullName, email, department, photoUrl, error };
  });
}
