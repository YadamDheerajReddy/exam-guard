"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createOrganizationWithAdmin } from "@/app/admin/(protected)/(platform)/organizations/actions";
import { CopyButton } from "@/components/copy-button";
import { COMMON_TIME_ZONES } from "@/lib/timezone";
import { Building2, Sparkles, X } from "lucide-react";

export function OrgCreateDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createOrganizationWithAdmin, undefined);
  // "Add another" needs to hide a still-present success result without
  // clearing useActionState itself (there's no API for that) — a plain
  // dismissed flag, reset on the next submit, does it without an effect.
  const [dismissed, setDismissed] = useState(false);
  const credentials = state && "success" in state && !dismissed ? state : null;

  function handleClose() {
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-ink/40"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent-tint text-accent">
                  <Building2 className="size-5" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-ink">New organization</h2>
                  <p className="text-xs text-slate">Onboard an institution to ExamGuard.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="rounded-lg p-1.5 text-slate transition-colors hover:bg-surface hover:text-ink"
              >
                <X className="size-5" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 px-6 py-6">
              <AnimatePresence mode="wait">
                {credentials ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex items-center gap-2 text-verified">
                      <div className="flex size-10 items-center justify-center rounded-full bg-verified-tint">
                        <Sparkles className="size-5" strokeWidth={2} />
                      </div>
                    </div>
                    <p className="mt-3 text-base font-bold text-ink">{credentials.orgName} is live</p>
                    <p className="mt-1 text-sm text-slate">
                      Share these credentials with the org&apos;s admin securely — the password is shown once and
                      can&apos;t be retrieved again.
                    </p>

                    <div className="mt-4 flex flex-col gap-3 rounded-lg bg-surface p-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate">Login email</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="truncate font-mono text-sm text-ink">{credentials.adminEmail}</p>
                          <CopyButton value={credentials.adminEmail} />
                        </div>
                      </div>
                      <div className="border-t border-border pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate">Temp password</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="truncate font-mono text-sm text-ink">{credentials.tempPassword}</p>
                          <CopyButton value={credentials.tempPassword} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDismissed(true)}
                        className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-charcoal transition-colors hover:bg-surface"
                      >
                        Add another
                      </button>
                      <button
                        type="button"
                        onClick={handleClose}
                        className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                      >
                        Done
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    action={formAction}
                    onSubmit={() => setDismissed(false)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="orgName" className="text-sm font-semibold text-charcoal">
                        Organization name
                      </label>
                      <input
                        id="orgName"
                        name="orgName"
                        placeholder="e.g. Sathyabama University"
                        required
                        className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="orgType" className="text-sm font-semibold text-charcoal">
                        Type
                      </label>
                      <select
                        id="orgType"
                        name="orgType"
                        defaultValue="COLLEGE"
                        className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
                      >
                        <option value="COLLEGE">College</option>
                        <option value="UNIVERSITY">University</option>
                        <option value="SCHOOL">School</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="orgTimezone" className="text-sm font-semibold text-charcoal">
                        Timezone
                      </label>
                      <select
                        id="orgTimezone"
                        name="orgTimezone"
                        defaultValue="Asia/Kolkata"
                        className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
                      >
                        {COMMON_TIME_ZONES.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate">
                        Exam times are entered as local wall-clock times in this zone — it decides when passes
                        unlock and expire.
                      </p>
                    </div>

                    <div className="mt-2 border-t border-border pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate">First admin</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="adminFullName" className="text-sm font-semibold text-charcoal">
                        Full name
                      </label>
                      <input
                        id="adminFullName"
                        name="adminFullName"
                        placeholder="Admin full name"
                        required
                        className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="adminEmail" className="text-sm font-semibold text-charcoal">
                        Email
                      </label>
                      <input
                        id="adminEmail"
                        name="adminEmail"
                        type="email"
                        placeholder="admin@institution.edu"
                        required
                        className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
                      />
                    </div>

                    {state && "error" in state && (
                      <p className="animate-in fade-in rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
                        {state.error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={pending}
                      className="mt-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                    >
                      {pending ? "Creating…" : "Create organization"}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
