"use client";

import { useActionState, useState } from "react";
import { changePassword } from "@/app/admin/(protected)/change-password/actions";
import { AlertCircle, KeyRound } from "lucide-react";

export function ChangePasswordForm({
  needsOrganizationId,
  suggestions,
}: {
  needsOrganizationId: boolean;
  suggestions: string[];
}) {
  const [state, formAction, pending] = useActionState(changePassword, undefined);
  const [organizationId, setOrganizationId] = useState("");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 rounded-lg border border-border bg-white p-8 shadow-sm duration-300">
        <KeyRound className="size-7 text-accent" strokeWidth={2} />
        <h1 className="mt-3 text-xl font-bold text-ink">
          {needsOrganizationId ? "Set up your account" : "Set a new password"}
        </h1>
        <p className="mt-1 text-sm text-slate">
          {needsOrganizationId
            ? "Choose a password only you know, and an Organization ID for your institution."
            : "Choose a password only you know before continuing."}
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

          {needsOrganizationId && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="organizationId" className="text-sm font-semibold text-charcoal">
                Organization ID
              </label>
              <input
                id="organizationId"
                name="organizationId"
                type="text"
                required
                minLength={3}
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                placeholder="e.g. sathyabama-university"
                className="rounded-lg border border-border px-4 py-3 font-mono text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
              />
              <p className="text-xs text-slate">
                Students use this to sign in, alongside their roll number. Choose
                something short and memorable — it can&rsquo;t be changed later.
              </p>
              {suggestions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setOrganizationId(s)}
                      className="rounded-lg border border-border bg-surface px-3 py-1 font-mono text-xs text-charcoal hover:border-accent hover:text-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
            {pending ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
