-- Self-service password reset for org admins and invigilators, mirroring
-- the student flow (0019) but kept in a separate table since admins and
-- invigilators are two different profile tables with no single FK either
-- could reference — account_id is deliberately a plain uuid (matches
-- auth.users.id) rather than a declared foreign key, both because it needs
-- to point at two different tables depending on account_type, and to avoid
-- repeating the ambiguous-embedding bug from 0020 (a second FK back to
-- admins/invigilators would make existing embedded queries ambiguous).
--
-- Deliberately excludes SUPER_ADMIN: the request-side lookup in
-- lib/account-password-reset.ts filters `role <> 'SUPER_ADMIN'` before
-- ever creating a token, so no token can exist for a super admin account
-- regardless of what email is submitted.
create table account_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  account_type varchar(20) not null check (account_type in ('ADMIN', 'INVIGILATOR')),
  account_id uuid not null,
  account_email varchar(150) not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_account_reset_account on account_password_reset_tokens(account_id);
create index idx_account_reset_lookup on account_password_reset_tokens(token_hash) where used_at is null;

-- Enabled with zero policies, matching password_reset_tokens — only ever
-- touched via the service-role client from the request/redeem actions.
alter table account_password_reset_tokens enable row level security;
