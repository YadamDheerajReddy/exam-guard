"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { dayLabel } from "@/lib/day-label";
import { type ExamStatus } from "@/lib/reveal";
import { CalendarClock, ChevronRight, ClipboardList, Layers, QrCode, Sparkles } from "lucide-react";

export type StudentScheduleItem =
  | {
      kind: "exam";
      examId: string;
      courseCode: string;
      courseTitle: string;
      examDate: string;
      startTime: string;
      status: ExamStatus;
    }
  | {
      kind: "group";
      groupId: string;
      groupName: string;
      examCount: number;
      examDate: string;
      startTime: string;
      status: ExamStatus;
    };

function itemId(item: StudentScheduleItem) {
  return item.kind === "exam" ? item.examId : item.groupId;
}
function itemHref(item: StudentScheduleItem) {
  return item.kind === "exam" ? `/student/exams/${item.examId}` : `/student/exam-groups/${item.groupId}`;
}
function itemTitle(item: StudentScheduleItem) {
  return item.kind === "exam" ? item.courseCode : item.groupName;
}
function itemSubtitle(item: StudentScheduleItem) {
  return item.kind === "exam" ? item.courseTitle : `${item.examCount} exam${item.examCount === 1 ? "" : "s"}`;
}

const STATUS_LABEL: Record<ExamStatus, string> = {
  upcoming: "Upcoming",
  "pass-ready": "Pass ready",
  completed: "Completed",
};

const STATUS_CLASS: Record<ExamStatus, string> = {
  upcoming: "bg-inactive-tint text-inactive",
  "pass-ready": "bg-verified-tint text-verified",
  completed: "bg-surface text-slate",
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};

export function StudentDashboard({ fullName, exams }: { fullName: string; exams: StudentScheduleItem[] }) {
  const firstName = fullName.trim().split(/\s+/)[0] ?? fullName;
  const active = exams.filter((e) => e.status !== "completed");
  const completed = exams.filter((e) => e.status === "completed");

  // The most actionable exam first — a pass ready to show beats a merely
  // upcoming one, since that's the one a student is most likely here for.
  const featured =
    active.find((e) => e.status === "pass-ready") ?? active[0] ?? null;
  // Still-actionable exams stay above finished ones. Without this a
  // completed exam from last week sorts (chronologically) above one coming
  // up next month, which buries the thing the student actually needs.
  const rest = exams
    .filter((e) => (featured ? itemId(e) !== itemId(featured) : true))
    .sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed"));

  return (
    <div className="mx-auto w-full max-w-2xl">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="text-xl font-bold text-ink">Hi, {firstName}</h1>
        <p className="mt-1 text-sm text-slate">
          {active.length === 0
            ? "No active exams right now."
            : `${active.length} exam${active.length === 1 ? "" : "s"} on your schedule${
                completed.length > 0 ? ` · ${completed.length} completed` : ""
              }.`}
        </p>
      </motion.div>

      {exams.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-white p-10 text-center">
          <ClipboardList className="mx-auto size-8 text-slate" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-slate">
            No exams mapped to you yet. Check back once your institution publishes the schedule.
          </p>
        </div>
      ) : (
        <>
          {featured && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                href={itemHref(featured)}
                className="mt-6 block overflow-hidden rounded-2xl bg-gradient-to-br from-[#122c56] via-accent to-[#0d7ce0] p-6 text-white shadow-lg transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/70">
                  {featured.kind === "group" ? (
                    <Layers className="size-3.5" strokeWidth={2} />
                  ) : (
                    <Sparkles className="size-3.5" strokeWidth={2} />
                  )}
                  {featured.status === "pass-ready" ? "Your pass is ready" : "Up next"}
                </div>
                <p className="mt-2 text-2xl font-extrabold">{itemTitle(featured)}</p>
                <p className="text-sm text-white/85">{itemSubtitle(featured)}</p>
                <div className="mt-4 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs text-white/75">
                    <CalendarClock className="size-3.5 shrink-0" strokeWidth={2} />
                    {featured.examDate} · {featured.startTime} · {dayLabel(featured.examDate).text}
                  </p>
                  <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
                    <QrCode className="size-3.5" strokeWidth={2} />
                    View pass
                  </span>
                </div>
              </Link>
            </motion.div>
          )}

          {rest.length > 0 && (
            <motion.div variants={container} initial="hidden" animate="show" className="mt-4 flex flex-col gap-3">
              {rest.map((exam) => {
                const day = dayLabel(exam.examDate);
                return (
                  <motion.div key={itemId(exam)} variants={item}>
                    <Link
                      href={itemHref(exam)}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-bold text-ink">
                          {exam.kind === "group" && <Layers className="size-3.5 shrink-0 text-slate" strokeWidth={2} />}
                          {itemTitle(exam)}
                        </p>
                        <p className="truncate text-sm text-slate">{itemSubtitle(exam)}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate">
                          <CalendarClock className="size-3.5 shrink-0" strokeWidth={2} />
                          {exam.examDate} · {exam.startTime}
                          {exam.status !== "completed" && ` · ${day.text}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_CLASS[exam.status]}`}
                        >
                          {STATUS_LABEL[exam.status]}
                        </span>
                        <ChevronRight className="size-4 text-slate" strokeWidth={2} />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
