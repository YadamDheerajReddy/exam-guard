"use client";

import { useState, useTransition } from "react";
import { correctVerificationLog } from "@/app/admin/(protected)/(org)/audit-log/actions";
import { AlertCircle, AlertTriangle, CheckCircle2, Download, Flag, PenLine, ScrollText, UserMinus, X } from "lucide-react";

export type AuditLogRow = {
  id: string;
  verifiedAt: string;
  status: string;
  notes: string | null;
  correctsLogId: string | null;
  correctedByName: string | null;
  supersededBy: string | null;
  invigilatorName: string;
  courseCode: string;
  hallLabel: string;
  rollNumber: string;
  fullName: string;
  seatNumber: string;
};

const CORRECTION_STATUSES = [
  { value: "VERIFIED", label: "Verified", icon: CheckCircle2 },
  { value: "WRONG_HALL", label: "Wrong hall", icon: AlertTriangle },
  { value: "FLAGGED", label: "Flagged", icon: Flag },
  { value: "ABSENT", label: "Absent", icon: UserMinus },
];

const STATUS_CLASS: Record<string, string> = {
  VERIFIED: "bg-verified-tint text-verified",
  WRONG_HALL: "bg-alert-tint text-alert",
  FLAGGED: "bg-pending-tint text-pending",
};

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  VERIFIED: CheckCircle2,
  WRONG_HALL: AlertTriangle,
  FLAGGED: Flag,
  ABSENT: UserMinus,
};

function downloadCsv(rows: AuditLogRow[]) {
  const csv = [
    // Corrections are exported too — the whole point of an append-only log
    // is that the superseded row stays visible alongside what replaced it.
    "verified_at,status,roll_number,full_name,seat_number,course_code,hall,invigilator,notes,entry_type,corrected_by",
    ...rows.map((r) =>
      [
        r.verifiedAt,
        r.status,
        r.rollNumber,
        r.fullName,
        r.seatNumber,
        r.courseCode,
        r.hallLabel,
        r.invigilatorName,
        r.notes ?? "",
        r.correctsLogId ? "correction" : r.supersededBy ? "superseded" : "scan",
        r.correctedByName ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "examguard-audit-log.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function AuditLogTable({ rows }: { rows: AuditLogRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate">{rows.length} event{rows.length === 1 ? "" : "s"}</p>
        <button
          onClick={() => downloadCsv(rows)}
          disabled={rows.length === 0}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-surface disabled:opacity-50"
        >
          <Download className="size-4" strokeWidth={2} />
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto overflow-hidden rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-wide text-slate">
              <th className="whitespace-nowrap px-4 py-3">Time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Hall / Seat</th>
              <th className="px-4 py-3">Invigilator</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-sm text-slate">
                  <ScrollText className="mx-auto size-8 text-slate" strokeWidth={1.5} />
                  <p className="mt-3">No events match these filters.</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => <LogRow key={row.id} row={row} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogRow({ row }: { row: AuditLogRow }) {
  const [correcting, setCorrecting] = useState(false);
  const [status, setStatus] = useState("VERIFIED");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const StatusIcon = STATUS_ICON[row.status];
  const isCorrection = Boolean(row.correctsLogId);
  const isSuperseded = Boolean(row.supersededBy);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await correctVerificationLog(row.id, status, reason);
      if (result.error) setError(result.error);
      else {
        setCorrecting(false);
        setReason("");
      }
    });
  }

  return (
    <>
      <tr
        className={`border-b border-border transition-colors last:border-0 hover:bg-surface ${
          isSuperseded ? "opacity-60" : ""
        }`}
      >
        <td className="whitespace-nowrap px-4 py-3 text-charcoal" title={new Date(row.verifiedAt).toISOString()}>
          {new Date(row.verifiedAt).toLocaleString()}
        </td>
        <td className="px-4 py-3">
          <span
            className={`flex w-fit items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_CLASS[row.status] ?? "bg-inactive-tint text-inactive"}`}
          >
            {StatusIcon && <StatusIcon className="size-3.5" strokeWidth={2} />}
            {row.status}
          </span>
          {isCorrection && (
            <span className="mt-1 flex w-fit items-center gap-1 rounded bg-accent-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              <PenLine className="size-3" strokeWidth={2} />
              Correction
            </span>
          )}
          {isSuperseded && (
            <span className="mt-1 block w-fit rounded bg-inactive-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-inactive">
              Superseded
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className="font-mono text-charcoal">{row.rollNumber}</span>{" "}
          <span className="text-charcoal">{row.fullName}</span>
        </td>
        <td className="px-4 py-3 text-charcoal">{row.courseCode}</td>
        <td className="px-4 py-3 text-charcoal">
          {row.hallLabel}
          {row.seatNumber !== "—" && <span className="font-mono text-slate"> · {row.seatNumber}</span>}
        </td>
        <td className="px-4 py-3 text-charcoal">
          {row.invigilatorName}
          {row.correctedByName && (
            <span className="block text-xs text-slate">corrected by {row.correctedByName}</span>
          )}
        </td>
        <td className="px-4 py-3 text-slate">{row.notes ?? "—"}</td>
        <td className="px-4 py-3 text-right">
          {/* Only an original, un-corrected scan can be corrected — a
           * correction of a correction would make the trail unreadable. */}
          {!isCorrection && !isSuperseded && !correcting && (
            <button
              onClick={() => setCorrecting(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
            >
              <PenLine className="size-3.5" strokeWidth={2} />
              Correct
            </button>
          )}
        </td>
      </tr>

      {correcting && (
        <tr className="border-b border-border bg-surface">
          <td colSpan={8} className="px-4 py-4">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">
                  Correct this scan for {row.rollNumber} · {row.fullName}
                </p>
                <p className="mt-0.5 text-xs text-slate">
                  The original stays in the log — this adds a new entry that supersedes it.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {CORRECTION_STATUSES.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setStatus(option.value)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        status === option.value
                          ? "border-accent bg-accent-tint text-accent"
                          : "border-border text-charcoal hover:bg-white"
                      }`}
                    >
                      <Icon className="size-3.5" strokeWidth={2} />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for the correction (required)"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
              />

              {error && (
                <p className="flex items-center gap-1.5 text-xs text-alert">
                  <AlertCircle className="size-3.5 shrink-0" strokeWidth={2} />
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={submit}
                  disabled={pending || !reason.trim()}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {pending ? "Recording…" : "Record correction"}
                </button>
                <button
                  onClick={() => {
                    setCorrecting(false);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-surface"
                >
                  <X className="size-3.5" strokeWidth={2} />
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
