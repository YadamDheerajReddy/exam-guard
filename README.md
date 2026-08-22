<p align="center">
  <img src="https://raw.githubusercontent.com/YadamDheerajReddy/exam-guard/main/web/src/app/icon.svg" width="72" alt="ExamGuard logo" />
</p>

<h1 align="center">ExamGuard</h1>

<p align="center">
  <b>The hall, the seat, and the face — verified the moment a student walks in.</b><br />
  A smart exam allocation and identity-verification system for institutions that still run
  attendance off a clipboard.
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
  <img alt="Expo" src="https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%7C%20Auth%20%7C%20Storage-3ECF8E?logo=supabase&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="Status" src="https://img.shields.io/badge/status-active%20development-informational" />
</p>

---

## What it does

An admin uploads a roster and maps students to exam halls and seats. Each student gets a
**barcode pass** whose hall and seat stay hidden until a configurable reveal window — no crowding
around a printed seating chart the night before. At the door, an invigilator scans that barcode
with their phone — **online or fully offline** — and gets an instant identity, hall, and seat
match, with a photo to eyeball against the person standing in front of them.

Three surfaces, one data model:

| Surface | Who | Where |
|---|---|---|
| **Admin Console** | Institution staff | `web/` → `/admin` |
| **Student Portal** | Students | `web/` → `/student` |
| **Invigilator Scanner** | Hall invigilators | `mobile/` (Expo) |

## Why it's not just a QR generator

- **Time-gated reveal, computed live.** No cron job decides when a hall/seat unlocks — it's a
  pure function of `now` vs. the exam's start time and reveal threshold, evaluated fresh on every
  request, IANA-timezone-aware. There's no "missed reveal" state to recover from.
- **A screenshot doesn't work at the door.** The rendered QR is a short-lived token that rotates
  every 90 seconds; only the server holds the signing key, and only the server's sync endpoint
  ever verifies it — the phone decodes but never trusts what it scans. (Schools get an exception:
  a single long-lived, printable pass — see below.)
- **Scans work with no signal.** Every scan writes to the invigilator's phone first, against a
  pre-synced local roster, then syncs in the background. One decision engine, one code path,
  whether the hall has wifi or not.
- **The audit trail can't be quietly edited.** Verification records are append-only — a correction
  to a wrong scan is a *new* row referencing the original, never an update or delete. You can
  always see what was recorded at the door and what an admin decided afterward.
- **Built for real institutions, not just universities.** Schools get class/grade instead of
  department, a single printable pass instead of a rotating code (no phone assumed), and DPDP
  Act 2023 consent/grievance/data-rights tooling baked in, not bolted on.

## Feature tour

<details>
<summary><b>🎓 Admin Console</b></summary>

- Roster upload — CSV, manual entry, or reuse of existing students, with per-row validation and
  a downloadable error report
- Student management — edit, deactivate, reset password, or offboard a student (auto-anonymized
  instead of deleted if they have exam history, to protect the audit trail)
- Halls, exams, and seat mapping with a database-level uniqueness guarantee (no seat double-booked,
  ever, regardless of application logic)
- Up to 2 active invigilators per hall, enforced server-side including the reactivation edge case
- Live Attendance dashboard and an Audit Log with a real correction workflow
- DPDP data-rights request queue (access / correction / erasure) with automatic
  anonymize-vs-delete handling
- Self-service password reset for admins and invigilator-password reset by admins; org onboarding
  captures the institution's DPDP consent and Grievance Officer contact

</details>

<details>
<summary><b>🧑‍🎓 Student Portal</b></summary>

- Roll number + password login (no email signup) with forced first-login password change
- Exam pass with a live-rotating barcode, or a single printable QR for school students —
  auto-formatted for A4 printing
- Hall & seat reveal countdown, plus a best-effort seat-map visualization (marked BETA — it's a
  schematic guess, not the hall's real layout)
- "My Data & Privacy" page: see exactly what's stored, and file an access/correction/erasure
  request under the DPDP Act
- Self-service password reset

</details>

<details>
<summary><b>📱 Invigilator Scanner (Expo)</b></summary>

- Full-screen camera scanner and manual roll-number search, sharing one verification engine
- **Offline-first**: every scan lands in local SQLite first, syncs in the background, idempotent
  via a client-generated event ID — works the same whether the hall has signal or not
- Pre-synced roster includes every hall's mappings, not just the invigilator's own, so a
  wrong-hall scan can still redirect correctly with zero connectivity
- Session Summary with **Present** and **Absent** rosters — photo, name, roll number, department,
  seat, and check-in time for each
- No self-service password reset by design — an admin resets it from the console

</details>

## Architecture at a glance

```
┌────────────────┐        ┌──────────────────┐        ┌───────────────────┐
│  Admin Console │        │  Student Portal  │        │ Invigilator Scanner│
│  (Next.js)     │        │  (Next.js)       │        │ (Expo / RN)        │
└───────┬────────┘        └────────┬─────────┘        └─────────┬──────────┘
        │  cookie session (RLS-scoped)                │  Bearer token → /api/invigilator/*
        ▼                          ▼                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                              Supabase                                     │
│   Postgres + Row-Level Security · Auth · Storage (private, signed URLs)   │
└──────────────────────────────────────────────────────────────────────────┘
```

Admins, students, and invigilators all authenticate through Supabase Auth, but differently: admins
and invigilators use institutional email + password; students use roll number + password mapped to
a synthetic, never-emailed auth identity, keeping the real contact email free for actual
correspondence. The mobile app can't share the web app's cookie session, so it talks to a small
Bearer-token JSON API instead — the *only* place `BARCODE_TOKEN_SECRET` ever lives is on the
server; the phone decodes a scanned token locally for display, but the server is the sole
authority on whether it's real.

## Tech stack

| Layer | Choice |
|---|---|
| Web (Admin + Student) | Next.js 16 (App Router, Server Actions), React 19, Tailwind CSS 4, Framer Motion |
| Mobile (Invigilator) | Expo SDK 54, React Native 0.81, Expo Router, `expo-sqlite`, Reanimated |
| Backend | Supabase — managed Postgres, Auth, Storage, Row-Level Security |
| Auth tokens | `jose` (HS256 JWT) for rotating/static barcode passes |
| Email | Nodemailer over Gmail SMTP (credential + password-reset emails) |
| Language | TypeScript, strict, end to end |

## Getting started

```bash
git clone https://github.com/YadamDheerajReddy/exam-guard.git
cd exam-guard
```

**Web** (Admin Console + Student Portal):

```bash
cd web
cp .env.example .env.local   # fill in the values below
npm install
npm run dev                   # → http://localhost:3000
```

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase project credentials — safe to ship to the browser, RLS does the real gating |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, bypasses RLS — used sparingly, for genuinely privileged operations |
| `BARCODE_TOKEN_SECRET` | Signs/verifies exam-pass tokens — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Sends credential and password-reset emails via any SMTP provider (Gmail App Password, Hostinger business email, etc.) — optional in dev, emails are skipped with a warning if unset |
| `MAIL_FROM` | Optional override for the emails' `From:` header — defaults to `ExamGuard <SMTP_USER>` |

**Mobile** (Invigilator Scanner):

```bash
cd mobile
npm install
npm start                     # scan the QR with Expo Go
```

| Variable | What it's for |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Same Supabase project as the web app |
| `EXPO_PUBLIC_API_BASE_URL` | The web app's origin — use your machine's **LAN IP**, not `localhost`, when testing on a physical phone through Expo Go |

There's no test suite configured in either app yet — don't go looking for one.

## Repo structure

```
exam-guard/
├── web/                    Next.js app — Admin Console, Student Portal, invigilator API
│   └── src/app/
│       ├── admin/          (org)-scoped console + (platform) super-admin views
│       ├── student/        Student Portal, exam pass, privacy/data-rights
│       └── api/invigilator/  Bearer-token JSON API the mobile app calls
├── mobile/                 Expo invigilator scanner — offline-first SQLite + sync queue
├── supabase/migrations/    Sequential SQL migrations, applied via Supabase MCP/dashboard
└── docs/                   Source-of-truth specs: PRD, TRD, UI/UX Brief, App Flow,
                             Backend Schema, Implementation Plan
```

## Security & compliance

- Row-Level Security everywhere; the service-role client (which bypasses it) is reserved for
  operations that genuinely need cross-tenant access, never used as a shortcut
- Password reset tokens (student, admin) are single-use, hashed at rest, short-lived, and
  rate-limited per account — a database leak alone can't be turned into a working reset link
- Every response to a "does this account exist" question is identical regardless of the answer —
  no enumeration surface
- Groundwork for India's **Digital Personal Data Protection Act, 2023**: a public privacy policy,
  per-institution consent capture and Grievance Officer contact, and a working
  access/correction/erasure request flow for students — the technical machinery the Act calls for,
  not a substitute for actual legal review

## Status

Core product (roster → mapping → reveal → scan → audit) is built and has been exercised end to
end, including real email delivery and live database verification during development — not just
unit-level checks. Beyond the original phase plan, this has since grown DPDP compliance tooling,
school-specific flows, and expanded self-service account management.

Not yet done: an automated test suite, load testing under real exam-day concurrency, and the
production-hardening items (monitoring, error tracking, mobile store distribution) that the
Implementation Plan scopes into Phase 5 — see [`docs/`](docs) for the full breakdown.

## Docs

The six PDFs in [`docs/`](docs) are the source of truth for data model and behavior; the
Implementation Plan documents one deliberate substitution — managed Supabase in place of the
original self-hosted Postgres/Redis/NestJS stack — everything else follows the specs as written.
