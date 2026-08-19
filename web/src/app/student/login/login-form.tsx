"use client";

import { useActionState, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { studentLogin, requestStudentPasswordReset } from "../actions";
import { Logo } from "@/components/logo";
import { AuthShell, fieldVariants } from "@/components/auth/auth-shell";
import { AlertCircle, CheckCircle2, IdCard, MailQuestion, X } from "lucide-react";

export function StudentLoginForm({ justReset }: { justReset: boolean }) {
  const [state, formAction, pending] = useActionState(studentLogin, undefined);
  const [institutionCode, setInstitutionCode] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetState, resetAction, resetPending] = useActionState(requestStudentPasswordReset, undefined);

  return (
    <AuthShell
      eyebrow="Student Portal"
      eyebrowIcon={IdCard}
      tagline="Your hall and seat unlock automatically before the exam. Your barcode does the rest."
    >
      <div className="hidden lg:block">
        <Logo size={28} />
      </div>
      <h1 className="mt-4 text-xl font-bold text-ink">Student Portal</h1>
      <p className="mt-1 text-sm text-slate">Sign in with your institution code and roll number.</p>

      {justReset && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-verified-tint px-3 py-2 text-sm text-verified">
          <CheckCircle2 className="size-4 shrink-0" strokeWidth={2} />
          Password updated — sign in with your new password.
        </p>
      )}

      <motion.form
        action={formAction}
        className="mt-6 flex flex-col gap-4"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      >
        <motion.div variants={fieldVariants} className="flex flex-col gap-1.5">
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
            className="rounded-lg border border-border px-4 py-3 font-mono text-sm text-ink outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent-tint"
          />
        </motion.div>

        <motion.div variants={fieldVariants} className="flex flex-col gap-1.5">
          <label htmlFor="rollNumber" className="text-sm font-semibold text-charcoal">
            Roll Number
          </label>
          <input
            id="rollNumber"
            name="rollNumber"
            type="text"
            required
            autoComplete="username"
            className="rounded-lg border border-border px-4 py-3 font-mono text-sm text-ink outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent-tint"
          />
        </motion.div>

        <motion.div variants={fieldVariants} className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-semibold text-charcoal">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-lg border border-border px-4 py-3 text-sm text-ink outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent-tint"
          />
        </motion.div>

        {state?.error && (
          <p className="animate-in fade-in flex items-center gap-2 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
            <AlertCircle className="size-4 shrink-0" strokeWidth={2} />
            {state.error}
          </p>
        )}

        <motion.button
          variants={fieldVariants}
          type="submit"
          disabled={pending}
          whileTap={{ scale: 0.98 }}
          className="mt-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </motion.button>
      </motion.form>

      <button
        type="button"
        onClick={() => setShowForgotPassword((v) => !v)}
        className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
      >
        <MailQuestion className="size-4" />
        Forgot password?
      </button>

      <AnimatePresence>
        {showForgotPassword && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 overflow-hidden"
          >
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink">Reset your password</p>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  aria-label="Close"
                  className="shrink-0 rounded-md p-0.5 text-slate transition-colors hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>

              {resetState?.message ? (
                <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-slate">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-verified" strokeWidth={2} />
                  {resetState.message}
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm leading-relaxed text-slate">
                    Enter your institution code and roll number — we&apos;ll email a reset link to the address
                    on file if there&apos;s a matching account.
                  </p>
                  <form action={resetAction} className="mt-3 flex flex-col gap-2.5">
                    <input
                      name="institutionCode"
                      type="text"
                      required
                      defaultValue={institutionCode}
                      placeholder="Institution code"
                      className="rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
                    />
                    <input
                      name="rollNumber"
                      type="text"
                      required
                      placeholder="Roll number"
                      className="rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
                    />
                    <button
                      type="submit"
                      disabled={resetPending}
                      className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                    >
                      {resetPending ? "Sending…" : "Send reset link"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
