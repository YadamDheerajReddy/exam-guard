"use client";

import { useState, useTransition } from "react";
import { reviewChangeRequest, type PlatformChangeRequestRow } from "@/app/admin/(protected)/(platform)/change-requests/actions";
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

function PendingRow({ request }: { request: PlatformChangeRequestRow }) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleReview(decision: "APPROVED" | "REJECTED") {
    setError(null);
    startTransition(async () => {
      const result = await reviewChangeRequest(request.id, decision, notes);
      if (result.error) setError(result.error);
    });
  }

  return (
    <li className="rounded-lg border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink">{request.subject}</p>
          <p className="text-xs text-slate">
            {request.organizationName} · {request.requestedByName} · {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-charcoal">{request.details}</p>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes for the org admin (optional)"
        rows={2}
        className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
      />

      {error && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-alert-tint px-3 py-2 text-xs text-alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => handleReview("APPROVED")}
          disabled={pending}
          className="rounded-lg bg-verified px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Working…" : "Approve"}
        </button>
        <button
          onClick={() => handleReview("REJECTED")}
          disabled={pending}
          className="rounded-lg border border-alert/30 px-3 py-1.5 text-xs font-semibold text-alert transition-colors hover:bg-alert-tint disabled:opacity-60"
        >
          {pending ? "Working…" : "Reject"}
        </button>
      </div>
    </li>
  );
}

function ReviewedRow({ request }: { request: PlatformChangeRequestRow }) {
  return (
    <li className="rounded-lg border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink">{request.subject}</p>
          <p className="text-xs text-slate">
            {request.organizationName} · {request.requestedByName} · {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-charcoal">{request.details}</p>
      {request.superAdminNotes && (
        <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs text-charcoal">
          <span className="font-semibold">Your notes: </span>
          {request.superAdminNotes}
        </p>
      )}
      {request.reviewedAt && (
        <p className="mt-1 text-xs text-slate">Reviewed {new Date(request.reviewedAt).toLocaleString()}</p>
      )}
    </li>
  );
}

export function ChangeRequestsReview({ requests }: { requests: PlatformChangeRequestRow[] }) {
  const pending = requests.filter((r) => r.status === "PENDING");
  const reviewed = requests.filter((r) => r.status !== "PENDING");

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
        <p className="text-sm text-slate">No change requests yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold text-charcoal">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-slate">Nothing waiting on you.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {pending.map((r) => (
              <PendingRow key={r.id} request={r} />
            ))}
          </ul>
        )}
      </div>

      {reviewed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-charcoal">Reviewed</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {reviewed.map((r) => (
              <ReviewedRow key={r.id} request={r} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
