"use client";

import { useActionState } from "react";
import { studentLogin } from "../actions";

export default function StudentLoginPage() {
  const [state, formAction, pending] = useActionState(studentLogin, undefined);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-lg border border-border bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-ink">Student Portal</h1>
        <p className="mt-1 text-sm text-slate">
          Sign in with your institution code and roll number.
        </p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="institutionCode" className="text-sm font-semibold text-charcoal">
              Institution Code
            </label>
            <input
              id="institutionCode"
              name="institutionCode"
              type="text"
              required
              autoComplete="organization"
              placeholder="Provided by your institution"
              className="rounded-lg border border-border px-4 py-3 font-mono text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rollNumber" className="text-sm font-semibold text-charcoal">
              Roll Number
            </label>
            <input
              id="rollNumber"
              name="rollNumber"
              type="text"
              required
              autoComplete="username"
              className="rounded-lg border border-border px-4 py-3 font-mono text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-semibold text-charcoal">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
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
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
