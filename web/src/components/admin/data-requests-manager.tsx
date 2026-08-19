"use client";

import { useState, useTransition } from "react";
import {
  completeDataRightsRequest,
  fulfillErasureRequest,
  rejectDataRightsRequest,
} from "@/app/admin/(protected)/(org)/data-requests/actions";
import { AlertCircle, CheckCircle2, Eye, Pencil, ScrollText, Trash2, XCircle } from "lucide-react";

export type DataRightsRequest = {
  id: string;
  rollNumber: string;
  fullName: string;
  requestType: "ACCESS" | "CORRECTION" | "ERASURE";
  details: string | null;
  status: "PENDING" | "COMPLETED" | "REJECTED";
  resolutionNotes: string | null;
  requestedAt: string;
};

const TYPE_ICON = { ACCESS: Eye, CORRECTION: Pencil, ERASURE: Trash2 };
const STATUS_CLASS = {
  PENDING: "bg-pending-tint text-pending",
  COMPLETED: "bg-verified-tint text-verified",
  REJECTED: "bg-inactive-tint text-inactive",
};

export function DataRequestsManager({ requests }: { requests: DataRightsRequest[] }) {
  const pending = requests.filter((r) => r.status === "PENDING");
  const resolved = requests.filter((r) => r.status !== "PENDING");

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white p-10 text-center shadow-sm">
        <ScrollText className="mx-auto size-8 text-slate" strokeWidth={1.5} />
        <p className="mt-3 text-sm text-slate">No data rights requests yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {pending.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <ul className="divide-y divide-border">
            {pending.map((r) => (
              <RequestRow key={r.id} request={r} />
            ))}
          </ul>
        </div>
      )}

      {resolved.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <p className="border-b border-border bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate">
            Resolved
          </p>
          <ul className="divide-y divide-border">
            {resolved.map((r) => (
              <RequestRow key={r.id} request={r} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RequestRow({ request }: { request: DataRightsRequest }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"complete" | "reject" | "erase" | null>(null);
  const [notes, setNotes] = useState("");

  const Icon = TYPE_ICON[request.requestType];

  function handleComplete() {
    setError(null);
    startTransition(async () => {
      const result = await completeDataRightsRequest(request.id, notes);
      if (result.error) setError(result.error);
      else setConfirming(null);
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectDataRightsRequest(request.id, notes);
      if (result.error) setError(result.error);
      else setConfirming(null);
    });
  }

  function handleErase() {
    setError(null);
    startTransition(async () => {
      const result = await fulfillErasureRequest(request.id);
      if (result.error) setError(result.error);
      else setConfirming(null);
    });
  }

  return (
    <li className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className="size-4 text-charcoal" strokeWidth={2} />
            <p className="text-sm font-bold text-ink">{request.requestType}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[request.status]}`}>
              {request.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-charcoal">
            <span className="font-mono">{request.rollNumber}</span> · {request.fullName}
          </p>
          {request.details && <p className="mt-1 text-sm text-slate">{request.details}</p>}
          <p className="mt-1 text-xs text-slate">{new Date(request.requestedAt).toLocaleString()}</p>
          {request.resolutionNotes && (
            <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs text-charcoal">{request.resolutionNotes}</p>
          )}
        </div>

        {request.status === "PENDING" && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {request.requestType === "ERASURE" ? (
              <button
                onClick={() => setConfirming("erase")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-alert px-3 py-1.5 text-xs font-semibold text-alert transition-colors hover:bg-alert-tint"
              >
                <Trash2 className="size-3.5" strokeWidth={2} />
                Fulfill erasure
              </button>
            ) : (
              <button
                onClick={() => setConfirming("complete")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-verified px-3 py-1.5 text-xs font-semibold text-verified transition-colors hover:bg-verified-tint"
              >
                <CheckCircle2 className="size-3.5" strokeWidth={2} />
                Mark completed
              </button>
            )}
            <button
              onClick={() => setConfirming("reject")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-charcoal transition-colors hover:bg-surface"
            >
              <XCircle className="size-3.5" strokeWidth={2} />
              Reject
            </button>
          </div>
        )}
      </div>

      {confirming && (
        <div className="mt-3 rounded-lg border border-border bg-surface p-3">
          {confirming === "erase" ? (
            <>
              <p className="text-sm text-charcoal">
                If this student has verification history, their personal data will be{" "}
                <strong>anonymized</strong> and the account permanently locked (records kept for audit). If not,
                everything about them will be <strong>permanently deleted</strong>. This can&apos;t be undone.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleErase}
                  disabled={pending}
                  className="rounded-lg bg-alert px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Processing…" : "Confirm erasure"}
                </button>
                <button onClick={() => setConfirming(null)} className="text-xs font-semibold text-slate">
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={confirming === "reject" ? "Reason for rejecting (required)" : "Notes (optional)"}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={confirming === "reject" ? handleReject : handleComplete}
                  disabled={pending}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Saving…" : confirming === "reject" ? "Confirm rejection" : "Confirm completion"}
                </button>
                <button onClick={() => setConfirming(null)} className="text-xs font-semibold text-slate">
                  Cancel
                </button>
              </div>
            </>
          )}
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-alert">
              <AlertCircle className="size-3.5 shrink-0" strokeWidth={2} />
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
