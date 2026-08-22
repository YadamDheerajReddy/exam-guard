# ExamGuard — Product Overview

## What is ExamGuard?

ExamGuard is a smart exam allocation and identity verification system for schools, colleges, and universities. It replaces the usual chaos of printed seating charts and manual ID checks at exam halls with three connected pieces:

1. **Admins** upload a student roster and map students to exam halls and seats.
2. **Students** get a dynamic, QR/barcode-based exam pass whose hall and seat are withheld until a set time before the exam (so seating can't be gamed in advance), viewable and printable from a web portal.
3. **Invigilators** scan that pass at the hall door — online or fully offline — to verify the student's identity and confirm they're in the right hall and seat, in real time.

It's built as a multi-tenant platform: many independent institutions ("organizations") run on the same deployment, each with its own admins, students, halls, and exams, fully isolated from one another.

## Who uses it

| Actor | Where | What they do |
|---|---|---|
| **Super Admin** | Web (`/admin`, platform console) | Manages the whole platform: onboards institutions, adds/removes org admins, reviews change requests |
| **Org Admin** (Exam Staff / Auditor) | Web (`/admin`, org console) | Runs one institution: roster, halls, exams, invigilators, attendance, compliance |
| **Student** | Web (`/student`) | Views their exam schedule, reveals their barcode pass, manages their privacy/data rights |
| **Invigilator** | Mobile app (Expo/React Native) | Scans student passes at the hall door, online or offline |

---

## Platform Console (Super Admin)

- **Organization management** — create new institutions (school, college, university, or other), each with its own type-specific behavior.
- **Add up to 6 admins per organization** after creation, choosing their role (Exam Staff or Auditor) — not just at org-creation time.
- **Edit organization details** — rename an organization, or change its Organization ID (slug). Changing the Organization ID automatically migrates every existing student's login so nobody gets locked out.
- **Delete an admin** from an organization (blocked from removing the last admin on an org).
- **Reset an admin's password** — issues a new temporary password and emails it, forcing a change on next login.
- **Suspend / reinstate an organization** — instantly blocks every admin, student, and invigilator login for that institution (e.g. for non-payment or offboarding), without deleting any data.
- **Change request review** — org admins can request changes they can't make themselves (e.g. a misspelled org name); the super admin reviews each request, approves or rejects it with notes, and the org admin sees the decision.
- **Sidebar notification badge** showing the count of pending change requests awaiting review.
- **Platform dashboard** — totals across every institution: organizations, admins, students, invigilators, exams, halls.

## Admin Console (Org Admin)

- **Roster upload** — bulk-import students via spreadsheet, with upload history and per-row validation.
- **Student management** — view, search, and manage the student roster; deactivate accounts; upload/replace student photos.
- **Hall management** — define exam halls (building, room, floor, capacity).
- **Exam management** — create exams with course code/title, date, time window, and a per-exam reveal threshold (how many minutes before start the hall/seat unlocks).
- **Exam groups** — bundle multiple papers (e.g. a mid-term series) into one group so students see a single combined entry with a combined printable pass, instead of one row per paper.
- **Seat mapping** — assign students to a hall and seat for each exam, with a hard database constraint preventing any seat from being double-booked.
- **Multi-invigilator halls** — assign several invigilators to the same hall, with a configurable per-hall cap.
- **Invigilator management** — create invigilator accounts, assign them to halls, reassign or deactivate them, reset their password.
- **Live attendance** — real-time view of check-ins as invigilators scan students during an exam.
- **Verification corrections** — a scan decision can be corrected after the fact; corrections are appended as new records, never silently overwriting the original (full audit trail).
- **Audit log** — a record of key admin actions across the organization.
- **Print tools** — printable individual hall tickets, bulk "print all" for a hall/exam, and printable session-summary rosters for invigilators.
- **Organization settings**:
  - Upload an organization logo — shown consistently across the admin console, the student portal, and the invigilator mobile app.
  - Organization details (address, contact number, contact email).
  - **Hall ticket customization** (school orgs): quick-start templates, custom header text/footer note/instructions letter, primary color, font, border style, header layout, logo size, header background (solid/gradient), organization-name color, up to two signature images with labels, and the ability to save/reuse custom designs as named templates.
  - **Request a change** — submit a free-text request to the super admin for anything the org admin can't edit themselves (e.g. the org's name).
- **Data Rights Requests (DPDP compliance)** — review and resolve student-submitted access, correction, and erasure requests; erasure either anonymizes or hard-deletes the student record depending on whether verification history exists.
- **Sidebar notification badge** showing the count of pending data rights requests.
- **Session summary rosters** — printable end-of-exam summaries for record-keeping.
- **Forced/self-service password resets** — admins can reset invigilator and student passwords; admins themselves get a forced password change with a self-healing check (a login attempt using the current temp-password pattern is always treated as needing a reset, even if the flag was never set).

## Student Portal

- **Exam schedule dashboard** — upcoming exams and exam groups, with status (upcoming / pass ready / completed), sorted so the most actionable item comes first.
- **Dynamic barcode pass** — hall and seat are hidden until the reveal threshold (default T-30 minutes); the displayed QR code rotates every 90 seconds so a screenshot goes stale quickly. The underlying page polls and sets a precise timer for the exact reveal moment.
- **Combined group pass** — one printable pass for an entire exam group instead of one per paper.
- **Printable hall tickets** — individually styled per the organization's hall-ticket customization (logo, colors, fonts, signatures).
- **Self-service password reset** and a forced password change on first login (temp password is deterministic from roll number + Organization ID, so it can always be reproduced/reset).
- **Privacy & data rights page** — see everything the platform stores about them (name, roll number, email, department, account status, photo), their exam records and seat assignments, and their institution's Grievance Officer contact. They can submit access, correction, or erasure requests under India's DPDP Act, 2023, and track the status/response of any request they've filed.
- **Organization branding** — the student header shows their institution's uploaded logo instead of the generic ExamGuard mark.

## Invigilator Mobile App (Expo / React Native)

- **Offline-first scanning** — every scan (barcode or manual roll-number search) is decided locally against a pre-synced roster cache and written to on-device SQLite first, whether the device is online or not.
- **Background sync** — a queued sync loop pushes scan events to the server whenever connectivity allows; the server re-verifies and is the final authority, so there's one code path for online and offline scanning.
- **Wrong-hall detection works offline** — the pre-synced roster includes every hall's mappings for an exam (not just the invigilator's assigned hall), so a student who wandered into the wrong hall is still redirected correctly with no network.
- **Manual roll-number search** as a fallback to barcode scanning.
- **Session summary** — an end-of-exam view of who was checked in.
- **Organization branding** — the app header shows the institution's uploaded logo (fetched via a signed URL, since it lives in a private storage bucket).
- **Forced/self-service password change** on first login or after an admin-triggered reset.

---

## Platform-Wide Capabilities

- **Multi-tenant isolation** — every table that matters is scoped to an organization, enforced at the database level (Postgres Row-Level Security), not just hidden in the UI. Admins, invigilators, and students can only ever see their own institution's data.
- **Role-based access** — `SUPER_ADMIN` (platform-wide), `EXAM_STAFF` and `AUDITOR` (org-scoped), enforced both by RLS policies and explicit server-side checks on every mutating action.
- **Two-tier signed barcode tokens** — a long-lived base token generated once per student mapping, and a short-lived (90s) rotating display token that's what actually gets scanned. The mobile app only *decodes* a scanned token on-device; cryptographic verification happens exclusively on the server at sync time, so the signing secret never ships inside the mobile app bundle.
- **No missed-reveal state** — the hall/seat reveal is computed live from the current time on every request rather than by a scheduled job, so there's nothing to "miss" or recover from if a server restarts.
- **DPDP Act, 2023 compliance** — grievance officer contact per organization, a student-facing data-rights request flow (access / correction / erasure), and an erasure path that anonymizes or deletes based on whether the record has verification history attached.
- **Append-only verification trail** — scan verification records are never edited or deleted; a correction is a new record referencing the original.
- **Consistent design system** — a shared neutral-plus-accent color system and status-color language (verified / alert / pending / inactive) across the web app and mobile app, including per-organization branding via the uploaded logo.
