"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { CalendarDays, Search } from "lucide-react";
import { dayLabel } from "@/lib/day-label";
import { type ExamStatus } from "@/lib/reveal";

export type UpcomingExam = {
  id: string;
  courseCode: string;
  courseTitle: string;
  examDate: string;
  startTime: string;
  mapped: number;
  status: ExamStatus;
};

type SortKey = "date" | "name" | "mapped";

export function UpcomingExamsList({ exams }: { exams: UpcomingExam[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? exams.filter((e) => e.courseCode.toLowerCase().includes(q) || e.courseTitle.toLowerCase().includes(q))
      : exams;

    return [...list].sort((a, b) => {
      // Finished exams sink below live ones under every sort — an exam that
      // ended this morning shouldn't sit above one starting this afternoon.
      const done = Number(a.status === "completed") - Number(b.status === "completed");
      if (done !== 0) return done;
      if (sortKey === "name") return a.courseCode.localeCompare(b.courseCode);
      if (sortKey === "mapped") return b.mapped - a.mapped;
      return `${a.examDate}${a.startTime}`.localeCompare(`${b.examDate}${b.startTime}`);
    });
  }, [exams, query, sortKey]);

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exams…"
            className="w-full min-w-0 rounded-lg border border-border py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-surface p-1">
          {([
            ["date", "Soonest"],
            ["name", "Course"],
            ["mapped", "Mapped"],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                sortKey === key ? "bg-white text-accent shadow-sm" : "text-slate hover:text-charcoal"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center">
          <CalendarDays className="mx-auto size-8 text-slate" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-slate">
            {exams.length === 0 ? (
              <>
                No upcoming exams.{" "}
                <Link href="/admin/exams" className="font-semibold text-accent">
                  Create one
                </Link>
                .
              </>
            ) : (
              "No exams match your search."
            )}
          </p>
        </div>
      ) : (
        <LayoutGroup>
          <ul className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {filtered.map((exam) => {
                // dayLabel only knows the date, so on exam day it would say
                // "Today" for something that finished hours ago — the
                // server-computed status is what actually settles that.
                const completed = exam.status === "completed";
                const day = dayLabel(exam.examDate);
                return (
                  <motion.li
                    key={exam.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Link
                      href={`/admin/exams/${exam.id}/mapping`}
                      className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-surface"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{exam.courseCode}</p>
                        <p className="truncate text-xs text-slate">{exam.courseTitle}</p>
                        <p className="mt-1 text-xs text-slate">
                          {exam.examDate} · {exam.startTime}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            completed
                              ? "bg-inactive-tint text-inactive"
                              : day.urgent
                                ? "bg-pending-tint text-pending"
                                : "bg-surface text-charcoal"
                          }`}
                        >
                          {completed ? "Completed" : day.text}
                        </span>
                        <span className="text-xs text-slate">{exam.mapped} mapped</span>
                      </div>
                    </Link>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </LayoutGroup>
      )}
    </div>
  );
}
