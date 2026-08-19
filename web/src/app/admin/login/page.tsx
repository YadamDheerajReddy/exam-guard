"use client";

import { useActionState } from "react";
import { motion } from "framer-motion";
import { adminLogin } from "../actions";
import { Logo } from "@/components/logo";
import { AuthShell, fieldVariants } from "@/components/auth/auth-shell";
import { AlertCircle, Building2 } from "lucide-react";

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(adminLogin, undefined);

  return (
    <AuthShell
      eyebrow="Admin Console"
      eyebrowIcon={Building2}
      tagline="Every roster, every hall, every seat — verified the moment a student walks in."
    >
      <div className="hidden lg:block">
        <Logo size={28} />
      </div>
      <h1 className="mt-4 text-xl font-bold text-ink">Admin Console</h1>
      <p className="mt-1 text-sm text-slate">Sign in with your institutional email.</p>

      <motion.form
        action={formAction}
        className="mt-6 flex flex-col gap-4"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      >
        <motion.div variants={fieldVariants} className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-semibold text-charcoal">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-lg border border-border px-4 py-3 text-sm text-ink outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent-tint"
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
    </AuthShell>
  );
}
