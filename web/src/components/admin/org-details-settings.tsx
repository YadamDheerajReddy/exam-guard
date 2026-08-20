"use client";

import { useActionState } from "react";
import { saveOrgDetails } from "@/app/admin/(protected)/(org)/settings/actions";

export function OrgDetailsSettings({
  initialAddress,
  initialContactNumber,
  initialContactEmail,
}: {
  initialAddress: string;
  initialContactNumber: string;
  initialContactEmail: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prevState: { error?: string; saved?: boolean } | undefined, formData: FormData) => {
      const result = await saveOrgDetails(formData);
      return result.error ? { error: result.error } : { saved: true };
    },
    undefined,
  );

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-charcoal">Organization details</h2>
      <p className="mt-1 text-sm text-slate">Shown on official communications and available for your records.</p>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-charcoal">Address</span>
          <textarea
            name="address"
            defaultValue={initialAddress}
            rows={2}
            placeholder="Street, city, state, postal code"
            className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-charcoal">Contact number</span>
            <input
              name="contactNumber"
              type="tel"
              defaultValue={initialContactNumber}
              placeholder="+91 40 1234 5678"
              className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-charcoal">Organization email</span>
            <input
              name="contactEmail"
              type="email"
              defaultValue={initialContactEmail}
              placeholder="office@yourschool.edu"
              className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
            />
          </label>
        </div>

        {state?.error && (
          <p className="rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">{state.error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          {state?.saved && !pending && <span className="text-xs font-semibold text-verified">Saved</span>}
        </div>
      </form>
    </div>
  );
}
