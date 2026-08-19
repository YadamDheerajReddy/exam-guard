-- Self-service student password reset. The raw token only ever exists in
-- the emailed link and this table's write path (createAdminClient) — what's
-- persisted is a SHA-256 hash, so a database leak alone can't be turned
-- into a usable reset link (same reasoning as never storing passwords in
-- plaintext). used_at makes each token single-use; expires_at bounds how
-- long a link stays live if the email is never opened.
--
-- RLS is enabled with zero policies, i.e. default-deny for both anon and
-- authenticated roles — this table is never read or written through the
-- cookie-scoped client, only through the service-role client from the two
-- server actions that own this flow (request + redeem).
create table password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_reset_tokens_student on password_reset_tokens(student_id);
create index idx_reset_tokens_lookup on password_reset_tokens(token_hash) where used_at is null;

alter table password_reset_tokens enable row level security;
