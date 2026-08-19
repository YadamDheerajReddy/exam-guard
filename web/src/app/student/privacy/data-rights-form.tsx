"use client";

import { useActionState, useState } from "react";
import { submitDataRightsRequest } from "./actions";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const REQUEST_LABELS: Record<string, string> = {
  ACCESS: "Access a copy of my data",
  CORRECTION: "Correct inaccurate data",
  ERASURE: "Erase my data",
};

export function DataRightsForm({ hasPending }: { hasPending: boolean }) {
  const [state, formAction, pending] = useActionState(submitDataRightsRequest, undefined);
  const [requestType, setRequestType] = useState("ACCESS");

  if (hasPending && !state?.ok) {
    return (
      <p className="mt-3 text-sm text-slate">
        You already have a pending request. Its status will appear below once your admin reviews it.
      </p>
    );
  }

  if (state?.ok) {
    return (
      <p className="mt-3 flex items-center gap-2 rounded-lg bg-verified-tint px-3 py-2 text-sm text-verified">
        <CheckCircle2 className="size-4 shrink-0" strokeWidth={2} />
        Request submitted — your admin will review it.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3">
      <select
        name="requestType"
        value={requestType}
        onChange={(e) => setRequestType(e.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
      >
        {Object.entries(REQUEST_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <textarea
        name="details"
        rows={2}
        placeholder={requestType === "CORRECTION" ? "What's inaccurate, and what it should say" : "Optional details"}
        className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
      />

      {state?.error && (
        <p className="flex items-center gap-2 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2} />
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
