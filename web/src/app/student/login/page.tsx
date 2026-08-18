"use client";

import { useActionState, useState, useTransition } from "react";
import { studentLogin, getOrgAdminEmails } from "../actions";
import { Logo } from "@/components/logo";
import { AlertCircle, MailQuestion, X } from "lucide-react";

export default function StudentLoginPage() {
  const [state, formAction, pending] = useActionState(studentLogin, undefined);
  const [institutionCode, setInstitutionCode] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [adminEmails, setAdminEmails] = useState<string[] | null>(null);
  const [lookupPending, startLookup] = useTransition();

  function handleForgotPasswordClick() {
    const opening = !showForgotPassword;
    setShowForgotPassword(opening);
    if (opening && institutionCode.trim()) {
      startLookup(async () => {
        setAdminEmails(await getOrgAdminEmails(institutionCode));
      });
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 rounded-lg border border-border bg-white p-8 shadow-sm duration-300">
        <Logo size={28} />
        <h1 className="mt-4 text-xl font-bold text-ink">Student Portal</h1>
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
              value={institutionCode}
              onChange={(e) => setInstitutionCode(e.target.value)}
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
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleForgotPasswordClick}
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
        >
          <MailQuestion className="size-4" />
          Forgot password?
        </button>

        {showForgotPassword && (
          <div className="mt-3 animate-in fade-in slide-in-from-top-1 rounded-lg border border-border bg-surface p-4 duration-200">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-ink">How to reset your password</p>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                aria-label="Close"
                className="shrink-0 rounded-md p-0.5 text-slate transition-colors hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate">
              Send an email to your exam department&apos;s admin office with your{" "}
              <span className="font-semibold text-charcoal">roll number</span> and{" "}
              <span className="font-semibold text-charcoal">institution code</span>, and ask them
              to reset your password. They&apos;ll issue you a new temporary password to sign in
              with.
            </p>

            {institutionCode.trim() ? (
              lookupPending ? (
                <p className="mt-2 text-sm text-slate">Looking up your admin&apos;s email…</p>
              ) : adminEmails && adminEmails.length > 0 ? (
                <p className="mt-2 text-sm leading-relaxed text-slate">
                  Your admin{adminEmails.length > 1 ? "s" : ""}:{" "}
                  {adminEmails.map((email, i) => (
                    <span key={email}>
                      {i > 0 && ", "}
                      <a href={`mailto:${email}`} className="font-semibold text-accent hover:text-accent-hover">
                        {email}
                      </a>
                    </span>
                  ))}
                </p>
              ) : adminEmails ? (
                <p className="mt-2 text-sm text-slate">
                  We couldn&apos;t find an admin for institution code{" "}
                  <span className="font-mono text-charcoal">{institutionCode}</span> — double-check it&apos;s correct.
                </p>
              ) : null
            ) : (
              <p className="mt-2 text-sm text-slate">Enter your institution code above to see your admin&apos;s email.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
