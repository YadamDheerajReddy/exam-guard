"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAttendanceRollup, type AttendanceRollup, type HallRollup, type StudentRollupRow } from "@/app/admin/(protected)/(org)/attendance/actions";

const RING_RADIUS = 30;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ hall }: { hall: HallRollup }) {
  const fraction = hall.total === 0 ? 0 : hall.verified / hall.total;
  const offset = RING_CIRCUMFERENCE * (1 - fraction);

  return (
    <svg width={76} height={76} viewBox="0 0 76 76">
      <circle cx={38} cy={38} r={RING_RADIUS} fill="none" stroke="#EEF0F3" strokeWidth={8} />
      <circle
        cx={38}
        cy={38}
        r={RING_RADIUS}
        fill="none"
        stroke="#1E8E5A"
        strokeWidth={8}
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 38 38)"
      />
      <text x={38} y={43} textAnchor="middle" fontSize={16} fontWeight={800} fill="#10131A">
        {Math.round(fraction * 100)}%
      </text>
    </svg>
  );
}

const STATUS_LABEL: Record<StudentRollupRow["status"], string> = {
  verified: "Verified",
  wrong_hall: "Wrong Hall",
  absent: "Absent",
  pending: "Pending",
};
const STATUS_CLASS: Record<StudentRollupRow["status"], string> = {
  verified: "bg-verified-tint text-verified",
  wrong_hall: "bg-alert-tint text-alert",
  absent: "bg-inactive-tint text-inactive",
  pending: "bg-pending-tint text-pending",
};

const POLL_INTERVAL_MS = 8_000;

export function AttendanceDashboard({ examId, initial }: { examId: string; initial: AttendanceRollup }) {
  const [rollup, setRollup] = useState(initial);
  const [expandedHallId, setExpandedHallId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const refresh = () => {
      startTransition(async () => {
        const fresh = await getAttendanceRollup(examId);
        setRollup(fresh);
      });
    };

    // Realtime is the fast path when it fires, but this project's managed
    // Realtime tenant doesn't reliably deliver postgres_changes events for
    // this table even with a matching publication + RLS policy (confirmed
    // live: direct REST reads succeed, the channel reaches SUBSCRIBED with
    // no error, yet INSERT events never arrive) — a known class of
    // environment-specific Realtime flakiness, not a logic bug here. A
    // short poll is the actual guarantee that "auto-updating without
    // refresh" holds; Realtime just makes it feel instant when it works.
    const supabase = createClient();
    const channel = supabase
      .channel(`verification_logs:${examId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "verification_logs" }, refresh)
      .subscribe();

    const interval = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [examId]);

  const expandedRows = expandedHallId ? rollup.studentRows.filter((r) => r.hallId === expandedHallId) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rollup.hallRollups.map((hall) => (
          <button
            key={hall.hallId}
            onClick={() => setExpandedHallId(expandedHallId === hall.hallId ? null : hall.hallId)}
            className={`flex items-center gap-4 rounded-lg border bg-white p-5 text-left transition-colors ${
              expandedHallId === hall.hallId ? "border-accent" : "border-border hover:border-accent"
            }`}
          >
            <ProgressRing hall={hall} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">
                {hall.buildingName} · {hall.roomNumber}
              </p>
              <p className="mt-1 text-xs text-slate">{hall.total} students mapped</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <span className="font-semibold text-verified">{hall.verified} verified</span>
                <span className="font-semibold text-alert">{hall.wrongHall} wrong hall</span>
                <span className="font-semibold text-inactive">{hall.absent} absent</span>
                <span className="font-semibold text-pending">{hall.pending} pending</span>
                {hall.flagged > 0 && <span className="font-semibold text-alert">{hall.flagged} flagged</span>}
              </div>
            </div>
          </button>
        ))}
        {rollup.hallRollups.length === 0 && (
          <p className="col-span-full rounded-lg border border-dashed border-border bg-white p-10 text-center text-sm text-slate">
            No students mapped to this exam yet.
          </p>
        )}
      </div>

      {expandedHallId && (
        <div className="overflow-x-auto overflow-hidden rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-wide text-slate">
                <th className="px-4 py-3">Roll number</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Seat</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {expandedRows.map((row) => (
                <tr key={row.mappingId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-charcoal">{row.rollNumber}</td>
                  <td className="px-4 py-3 text-charcoal">{row.fullName}</td>
                  <td className="px-4 py-3 font-mono text-charcoal">{row.seatNumber}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_CLASS[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                    {row.flagged && (
                      <span className="ml-2 rounded bg-alert-tint px-2 py-1 text-xs font-semibold uppercase tracking-wide text-alert">
                        Flagged
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {row.verifiedAt ? new Date(row.verifiedAt).toLocaleTimeString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
