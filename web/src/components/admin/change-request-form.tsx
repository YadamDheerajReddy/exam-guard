"use client";

import { useState, useTransition } from "react";
import { submitChangeRequest, type ChangeRequestRow } from "@/app/admin/(protected)/(org)/settings/change-request-actions";
import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-pending-tint text-pending",
  APPROVED: "bg-verified-tint text-verified",
  REJECTED: "bg-alert-tint text-alert",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[status]}`}>
      {status === "PENDING" && <Clock className="size-3.5" strokeWidth={2} />}
      {status === "APPROVED" && <CheckCircle2 className="size-3.5" strokeWidth={2} />}
      {status === "REJECTED" && <XCircle className="size-3.5" strokeWidth={2} />}
      {status[0] + status.slice(1).toLowerCase()}
    </span>
  );
}

export function ChangeRequestForm({ initialRequests }: { initialRequests: ChangeRequestRow[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (!details.trim()) {
      setError("Describe what you'd like changed.");
      return;
    }
    const formData = new FormData();
    formData.set("subject", subject.trim());
    formData.set("details", details.trim());

    startTransition(async () => {
      const result = await submitChangeRequest(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setRequests((prev) => [
        {
          id: `pending-${Date.now()}`,
          subject: subject.trim(),
          details: details.trim(),
          status: "PENDING",
          superAdminNotes: null,
          createdAt: new Date().toISOString(),
          reviewedAt: null,
        },
        ...prev,
      ]);
      setSubject("");
      setDetails("");
    });
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-charcoal">Request a change</h2>
      <p className="mt-1 text-sm text-slate">
        For things you can&apos;t change yourself — e.g. your organization&apos;s name is wrong. A super admin
        reviews these and makes the change.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject, e.g. Organization name is misspelled"
          className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Describe what needs to change and why."
          rows={3}
          className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-alert-tint px-3 py-2 text-xs text-alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={pending}
        className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit request"}
      </button>

      {requests.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Your requests</p>
          <ul className="mt-2 flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-charcoal">{r.subject}</p>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate">{r.details}</p>
                {r.superAdminNotes && (
                  <p className="mt-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-charcoal">
                    <span className="font-semibold">Response: </span>
                    {r.superAdminNotes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
