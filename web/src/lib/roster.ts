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
  rowNumber: number;
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
  photo_url: "photoUrl",
  photourl: "photoUrl",
  photo: "photoUrl",
};

export function normalizeHeader(header: string): keyof RosterRow | null {
  return HEADER_ALIASES[header.trim().toLowerCase()] ?? null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRosterRows(rows: RosterRow[]): ValidatedRosterRow[] {
  const rollSeen = new Map<string, number>();
  const emailSeen = new Map<string, number>();

  return rows.map((row, i) => {
    const rowNumber = i + 2; // header is row 1
    const rollNumber = row.rollNumber.trim();
    const fullName = row.fullName.trim();
    const email = row.email.trim().toLowerCase();
    const department = row.department.trim();
    const photoUrl = row.photoUrl.trim();

    let error: string | null = null;
    if (!rollNumber) error = "Missing roll number.";
    else if (!fullName) error = "Missing name.";
    else if (!email) error = "Missing email.";
    else if (!EMAIL_RE.test(email)) error = "Invalid email format.";
    else if (!department) error = "Missing department.";
    else if (rollSeen.has(rollNumber)) {
      error = `Duplicate roll number (also row ${rollSeen.get(rollNumber)}).`;
    } else if (emailSeen.has(email)) {
      error = `Duplicate email (also row ${emailSeen.get(email)}).`;
    }

    if (!error) {
      rollSeen.set(rollNumber, rowNumber);
      emailSeen.set(email, rowNumber);
    }

    return { rollNumber, fullName, email, department, photoUrl, rowNumber, error };
  });
}
