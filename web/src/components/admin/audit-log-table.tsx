"use client";

import { AlertTriangle, CheckCircle2, Download, Flag, ScrollText } from "lucide-react";

export type AuditLogRow = {
  id: string;
  verifiedAt: string;
  status: string;
  notes: string | null;
  invigilatorName: string;
  courseCode: string;
  hallLabel: string;
  rollNumber: string;
  fullName: string;
  seatNumber: string;
};

const STATUS_CLASS: Record<string, string> = {
  VERIFIED: "bg-verified-tint text-verified",
  WRONG_HALL: "bg-alert-tint text-alert",
  FLAGGED: "bg-pending-tint text-pending",
};

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  VERIFIED: CheckCircle2,
  WRONG_HALL: AlertTriangle,
  FLAGGED: Flag,
};

function downloadCsv(rows: AuditLogRow[]) {
  const csv = [
    "verified_at,status,roll_number,full_name,seat_number,course_code,hall,invigilator,notes",
    ...rows.map((r) =>
      [r.verifiedAt, r.status, r.rollNumber, r.fullName, r.seatNumber, r.courseCode, r.hallLabel, r.invigilatorName, r.notes ?? ""]
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
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-10 text-center text-sm text-slate">
                  <ScrollText className="mx-auto size-8 text-slate" strokeWidth={1.5} />
                  <p className="mt-3">No events match these filters.</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const StatusIcon = STATUS_ICON[row.status];
                return (
                  <tr key={row.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface">
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
                    <td className="px-4 py-3 text-charcoal">{row.invigilatorName}</td>
                    <td className="px-4 py-3 text-slate">{row.notes ?? "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
