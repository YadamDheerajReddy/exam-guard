"use client";

import { useActionState } from "react";
import { changeStudentPassword } from "./actions";

export default function StudentChangePasswordPage() {
  const [state, formAction, pending] = useActionState(changeStudentPassword, undefined);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-lg border border-border bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-ink">Set a new password</h1>
        <p className="mt-1 text-sm text-slate">
          Choose a password only you know before continuing.
        </p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
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
            <p className="rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
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
      </div>
    </main>
  );
}
