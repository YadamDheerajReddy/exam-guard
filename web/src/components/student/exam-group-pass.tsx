"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  getExamGroupPass,
  type ExamGroupPassResult,
} from "@/app/student/(protected)/exam-groups/[groupId]/actions";
import { Logo } from "@/components/logo";
import { CalendarCheck, CheckCircle2, Lock, MapPin, Printer, ScanLine } from "lucide-react";

const POLL_INTERVAL_MS = 60_000;

function formatCountdown(ms: number): string {
  if (ms <= 0) return "any moment now";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  const seconds = Math.floor((ms % 60_000) / 1000);
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function ExamGroupPass({ groupId, initial }: { groupId: string; initial: ExamGroupPassResult }) {
  const [pass, setPass] = useState(initial);
  const [nowMs, setNowMs] = useState(() => Date.now());

  async function refresh() {
    const result = await getExamGroupPass(groupId);
    setPass(result);
  }

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const settled = pass.ok && pass.exams.every((e) => e.checkedIn || e.completed);
  useEffect(() => {
    if (settled) return;
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  if (!pass.ok) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center">
        <p className="text-sm text-slate">{pass.error}</p>
      </div>
    );
  }

  const canPrint = pass.exams.some((e) => e.displayToken);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-5"
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-lg">
        <div className="bg-gradient-to-br from-[#122c56] via-accent to-[#0d7ce0] px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <Logo size={18} withWordmark={false} inverted />
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
              <ScanLine className="size-3" strokeWidth={2} />
              Exam group
            </span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/70">
            {pass.exams.length} exam{pass.exams.length === 1 ? "" : "s"}
          </p>
          <h1 className="mt-0.5 text-xl font-extrabold leading-tight">{pass.groupName}</h1>
        </div>

        {canPrint && (
          <div className="flex items-center justify-center px-6 py-4">
            <Link
              href={`/student/exam-groups/${groupId}/print`}
              target="_blank"
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              <Printer className="size-4" strokeWidth={2} />
              Print consolidated hall ticket
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {pass.exams.map((exam) => {
          const msUntilReveal = new Date(exam.revealAt).getTime() - nowMs;
          const statusKey = exam.checkedIn
            ? "checked-in"
            : exam.completed
              ? "completed"
              : exam.revealed && exam.hall
                ? "revealed"
                : "locked";

          return (
            <div key={exam.examId} className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <div className="px-5 py-3">
                <p className="text-sm font-bold text-ink">{exam.courseCode}</p>
                <p className="text-xs text-slate">{exam.courseTitle}</p>
                <p className="mt-1 text-xs text-slate">
                  {exam.examDate} · {exam.startTime}–{exam.endTime}
                </p>
              </div>

              {statusKey === "checked-in" ? (
                <div className="flex items-center gap-2 bg-verified-tint px-5 py-3">
                  <CheckCircle2 className="size-4 text-verified" strokeWidth={2} />
                  <p className="text-xs font-semibold text-verified">
                    Checked in{exam.checkedInAt ? ` · ${new Date(exam.checkedInAt).toLocaleString()}` : ""}
                  </p>
                </div>
              ) : statusKey === "completed" ? (
                <div className="flex items-center gap-2 bg-inactive-tint px-5 py-3">
                  <CalendarCheck className="size-4 text-inactive" strokeWidth={2} />
                  <p className="text-xs font-semibold text-inactive">Exam completed</p>
                </div>
              ) : statusKey === "revealed" && exam.hall ? (
                <div className="bg-verified-tint px-5 py-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-verified">
                    <MapPin className="size-3.5" strokeWidth={2} />
                    Hall &amp; seat
                  </p>
                  <p className="mt-1 text-sm font-bold text-ink">
                    {exam.hall.buildingName} · Room {exam.hall.roomNumber} · Seat {exam.hall.seatNumber}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-pending-tint px-5 py-3">
                  <Lock className="size-4 text-pending" strokeWidth={2} />
                  <p className="text-xs font-semibold text-pending">Unlocks in {formatCountdown(msUntilReveal)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
