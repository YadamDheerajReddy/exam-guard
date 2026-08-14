# ExamGuard

Smart exam allocation & identity verification system. See [`docs/`](docs) for
the PRD, TRD, UI/UX Brief, App Flow, Backend Schema, and Implementation Plan
that drive this build.

## Structure

- **`web/`** — Next.js app serving both the Admin Console (`/admin`) and the
  Student Portal (`/student`), deployed to Vercel.
- **`mobile/`** — Expo/React Native invigilator scanner app, run via Expo Go
  during development and distributed with EAS Build.
- **`supabase/migrations/`** — SQL migrations, applied to the shared Supabase
  project (Postgres + Auth + Storage + Realtime).

## Stack

Per the Implementation Plan's "Recommended Solo Stack": Supabase (managed
Postgres, Auth, Storage, Realtime, scheduled Edge Functions) in place of
self-hosted Postgres/Redis/NestJS, Next.js on Vercel for both web surfaces,
and Expo/EAS for the invigilator app — same data model and behavior as the
Backend Schema and App Flow docs, different hosting.

Supabase project: `examguard` (ref `ljpgflhmevmghfvcacnk`).

## Auth model

- **Admins & invigilators** sign in with their institutional email + password
  via Supabase Auth. A row in `admins` or `invigilators` (keyed to the same
  `auth.users.id`) determines their role; an authenticated user with no
  matching row is signed back out.
- **Students** sign in with roll number + password (FR-9). Supabase Auth
  identities need an email, so the roll number is mapped to a synthetic,
  never-emailed address (`{roll_number}@examguard.internal`) purely for
  authentication — see `web/src/lib/student-auth.ts`. The real contact email
  in `students.email` is untouched and reserved for password resets.

## Local development

```bash
# Web (admin console + student portal)
cd web && npm run dev

# Mobile (invigilator scanner) — scan the QR with Expo Go
cd mobile && npm start
```

Both apps read Supabase credentials from `.env.local` / `.env` — see
`web/.env.example`. The Supabase anon/publishable key is safe to keep in
version control; it has no access beyond what Row-Level Security grants.

## Phase status

Currently at the end of **Phase 0 — Foundation & Setup**: Supabase project
and schema live, both apps scaffolded and connected, basic auth wired with
blank authenticated screens. See `docs/6-ExamGuard_Implementation_Plan.pdf`
for the full phase breakdown.
