"use client";

import { useActionState } from "react";
import { redeemStudentPasswordReset } from "../actions";
import { AlertCircle, KeyRound } from "lucide-react";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [state, formAction, pending] = useActionState(redeemStudentPasswordReset, undefined);

  return (
    <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 rounded-lg border border-border bg-white p-8 shadow-sm duration-300">
      <KeyRound className="size-7 text-accent" strokeWidth={2} />
      <h1 className="mt-3 text-xl font-bold text-ink">Choose a new password</h1>
      <p className="mt-1 text-sm text-slate">This link works once and expires shortly, so finish here.</p>

      {!token ? (
        <p className="mt-6 flex items-center gap-2 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2} />
          This reset link is missing its token. Request a new one from the login page.
        </p>
      ) : (
        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="newPassword" className="text-sm font-semibold text-charcoal">
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded-lg border border-border px-4 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-semibold text-charcoal">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded-lg border border-border px-4 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
            />
          </div>

          {state?.error && (
            <p className="animate-in fade-in flex items-center gap-2 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
              <AlertCircle className="size-4 shrink-0" strokeWidth={2} />
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "Saving…" : "Set password"}
          </button>
        </form>
      )}
    </div>
  );
}
