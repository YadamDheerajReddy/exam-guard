# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

ExamGuard is a smart exam allocation & identity verification system: admins upload rosters and map students to exam halls/seats, students get a dynamic barcode pass whose hall/seat is withheld until a reveal threshold (default T-30 minutes), and invigilators scan that barcode at the hall door — online or offline — to verify identity and seat.

**`docs/`** contains the six source-of-truth specs (PRD, TRD, UI/UX Brief, App Flow, Backend Schema, Implementation Plan) that drive behavior, data model, and visual design. The Implementation Plan defines the phase breakdown (Phase 0 Foundation, Phase 1 Admin Core, Phase 2 Student Portal & Reveal Engine, Phase 3 Invigilator Scanner, Phase 4 Dashboard & Hardening, Phase 5 Pilot & Launch) — check it before assuming what's in scope for a given piece of work. It also documents a deliberate substitution vs. the original TRD stack: managed Supabase (Postgres + Auth + Storage) instead of self-hosted Postgres/Redis/NestJS — the data model and behavior in the other docs stay the source of truth, the Implementation Plan is the source of truth for what's actually built.

## Repo structure

- **`web/`** — Next.js app (App Router) serving the Admin Console (`/admin`) and Student Portal (`/student`), plus a small Bearer-token JSON API (`/api/invigilator/*`) the mobile app calls. Deployed to Vercel.
- **`mobile/`** — Expo/React Native invigilator scanner app (Expo Router), run via Expo Go during development, distributed with EAS Build.
- **`supabase/migrations/`** — Sequential SQL migrations against the shared Supabase project (`ljpgflhmevmghfvcacnk`), applied via the Supabase MCP tools or dashboard — there's no local Supabase CLI/db push workflow set up here.
- **`docs/`** — the six spec PDFs described above.

## Commands

Run from within `web/` or `mobile/` respectively (no root-level package.json).

```bash
# Web
cd web
npm run dev              # Next.js dev server, port 3000
npm run build             # production build (also runs the TypeScript check)
npm run lint               # eslint
npx tsc --noEmit           # typecheck only, without a full build

# Mobile
cd mobile
npm start                  # expo start — scan the QR with Expo Go
npm run web                 # expo start --web (SPA preview; see SQLite caveat below)
npm run lint                # expo lint
npx tsc --noEmit             # typecheck
```

There is no test suite configured in either app — don't assume one exists or invent test commands.

Both apps are also registered in `.claude/launch.json` as `examguard-web` (port 3000) and `examguard-mobile-web` (port 8081) for the Browser-pane preview tooling.

Env vars: `web/.env.example` lists the required Supabase + `BARCODE_TOKEN_SECRET` + `GMAIL_USER`/`GMAIL_APP_PASSWORD` vars for `web/.env.local`. Mobile reads `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_API_BASE_URL` from `mobile/.env` — the last one must be the machine's LAN IP (not `localhost`) when testing on a physical phone via Expo Go, since `localhost` from the phone resolves to the phone itself.

## Before writing code: check for framework drift

Both `web/AGENTS.md` and `mobile/AGENTS.md` (pulled in via each directory's `CLAUDE.md`) warn that this repo's Next.js/Expo versions may have breaking changes vs. training data, and point at versioned docs to check first. Treat the *version number* in those pointers with suspicion — cross-check it against the actually-installed version (`web/node_modules/next/package.json`, `mobile/node_modules/expo/package.json`) before trusting a hardcoded docs URL; these notes can drift out of sync with what's actually installed.

## Architecture

### Multi-tenant data model

`organizations` (admin-chosen `slug`, nullable until the org admin sets it on first login) scopes `admins`, `students`, `invigilators`, `halls`, and `exams`. `student_exam_mappings` links a student to an exam, hall, and seat, with a DB-level `UNIQUE(exam_id, hall_id, seat_number)` constraint so seat double-booking is impossible regardless of application logic. `verification_logs` is append-only — corrections are new rows referencing the original, never updates/deletes.

`admins.role` is `SUPER_ADMIN` (platform-wide, manages organizations) | `EXAM_STAFF` | `AUDITOR` (org-scoped). The `(protected)` admin route tree in `web/src/app/admin` splits into an `(org)` group and a `(platform)` group (super-admin-only, e.g. `/admin/organizations`) with separate layouts.

### Auth model

All three actor types (admins/invigilators, students, and — from the mobile app — invigilators again) authenticate via Supabase Auth, but differently:

- **Admins & invigilators**: institutional email + password. A row in `admins`/`invigilators` keyed to the same `auth.users.id` determines role and org; an authenticated user with no matching row is signed back out.
- **Students**: roll number + password (no email login). Since Supabase Auth identities require an email, the roll number is mapped to a synthetic, never-emailed address (`{rollNumber}.{orgSlug}@examguard.internal` — see `web/src/lib/student-auth.ts`). Temp passwords are deterministic (`{rollNumber}@{orgSlug}`) rather than random, so admins can always reproduce/reset them.
- **Forced password change**: rather than trust a `must_change_password` flag alone (a creation/reset path could forget to set it), the student login action (`web/src/app/student/actions.ts`) recomputes the expected temp password and forces a change if the password just used still matches it — self-healing regardless of which code path created/reset the account.
- **Mobile app**: the Expo app can't share the web app's cookie-based session, so `/api/invigilator/*` routes authenticate via a bearer access token (`web/src/lib/invigilator-context.ts`) instead of the cookie-based `createClient()` used by admin/student Server Components.

### RLS + authorization pattern

Postgres RLS policies lean on `private` schema helper functions not exposed via PostgREST: `private.is_admin()`, `private.is_super_admin()`, `private.admin_org_id()` (see `supabase/migrations/0002_phase1_admin_rls.sql` and `0003_organizations_multitenancy.sql`). Server Actions and Route Handlers are treated as untrusted entry points even where RLS also applies — mutating actions call `requireOrgAdmin()` / `requireSuperAdmin()` / `requireStudent()` / `requireInvigilator()` (in the corresponding `*-context.ts` file) explicitly, especially before any operation using `createAdminClient()` (`web/src/lib/supabase/admin.ts`), which holds the service-role key and bypasses RLS entirely — reserved for operations that genuinely need it (creating `auth.users` rows, cross-tenant reads for the invigilator API).

### Barcode token system

Two distinct signed tokens (`web/src/lib/barcode-token.ts`, HS256 via `jose`, secret `BARCODE_TOKEN_SECRET`), both carrying `mapping_id`/`exam_id`:

- **Base `barcode_token`**: long-lived (through the exam window + 6h buffer), generated once at mapping creation, stored on `student_exam_mappings`.
- **Rotating display token**: short-lived (90s), regenerated on every `getExamPass()` call, `kind: "display"` — this is what's actually rendered as the student's QR code and what an invigilator scans, so a screenshot goes stale fast.

The invigilator app **decodes but never cryptographically verifies** a scanned token on-device (`mobile/src/lib/decode-token.ts`) — shipping `BARCODE_TOKEN_SECRET` into a mobile bundle would let anyone extract it and forge passes. Signature+expiry verification only happens server-side, at sync time (`verifyDisplayToken()` in `barcode-token.ts`, called from `/api/invigilator/sync`), which is the actual authority on whether a scan becomes a `VERIFIED`/`WRONG_HALL`/`FLAGGED` `verification_logs` row.

### Reveal engine

No scheduled job/cron: `web/src/lib/reveal.ts`'s `computeRevealState()` is a pure function of `now` vs. `exam_date`/`start_time`/`reveal_threshold_minutes`, computed live on every request. The student exam-pass page polls periodically plus sets one precise timer for the exact reveal moment; either way the next request after T-30 simply returns the unlocked payload — there's no missed-reveal state to recover from since the server, not a client timer, is the source of truth.

### Mobile offline-first sync model

Every scan — online or offline — writes to the phone's local SQLite (`expo-sqlite`, `mobile/src/lib/local-db.ts`) first: decision computed locally against a pre-synced roster cache (`decideForToken`/`decideForManual` in `scan-decision.ts`), queued with a client-generated `client_event_id` used as an idempotency key. A background sync loop (`sync-engine.ts`) drains the queue to `/api/invigilator/sync` whenever connectivity allows; the server re-verifies and is the final authority (see above), so there's one code path for online and offline rather than two. The pre-synced roster deliberately includes **every** hall's mappings for an exam, not just the invigilator's assigned hall, so a wrong-hall scan can still render the correct-hall redirect fully offline.

`expo-sqlite`'s web-preview support is alpha and hits real limitations in Expo CLI's dev server internals (documented in `mobile/metro.config.js`) — don't expect `expo start --web` to fully exercise SQLite-dependent screens; that needs a real device via Expo Go.

### Design system

Both apps mirror the same token set: `web/src/app/globals.css` (CSS vars) and `mobile/src/constants/theme.ts` (`Colors`, `Radius`) — neutral base + a single institutional accent (deep blue) + four status colors reserved exclusively for verification states (verified/alert/pending/inactive), per the UI/UX Brief. The logo (`web/src/components/logo.tsx` and `mobile/src/components/logo.tsx`) is the same shield-and-checkmark SVG path data rendered via two different mechanisms (inline SVG vs. `react-native-svg`), not a shared file — keep them in sync by hand if the mark changes.
