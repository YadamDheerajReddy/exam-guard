"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, CalendarDays, ImageOff, ShieldCheck, Users } from "lucide-react";
import { StatCard, statCardContainer } from "@/components/admin/stat-card";
import { UpcomingExamsList, type UpcomingExam } from "@/components/admin/upcoming-exams-list";
import { CopyButton } from "@/components/copy-button";

type Totals = {
  halls: number;
  exams: number;
  seatsMapped: number;
  seatsCapacity: number;
  invigilators: number;
};

export function OrgDashboard({
  orgName,
  orgSlug,
  totals,
  upcomingExams,
  missingPhotos,
}: {
  orgName: string;
  orgSlug: string | null;
  totals: Totals;
  upcomingExams: UpcomingExam[];
  missingPhotos: number;
}) {
  const utilization = totals.seatsCapacity > 0 ? Math.round((totals.seatsMapped / totals.seatsCapacity) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-ink">{orgName}</h1>
          <p className="mt-1 text-sm text-slate">Exam-cycle overview.</p>
        </div>
        {orgSlug && (
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate">Org ID</span>
            <span className="font-mono text-sm font-semibold text-ink">{orgSlug}</span>
            <CopyButton value={orgSlug} />
          </div>
        )}
      </motion.div>

      {missingPhotos > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="mt-5 flex flex-col gap-3 rounded-xl border border-pending/30 bg-pending-tint p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <ImageOff className="mt-0.5 size-5 shrink-0 text-pending" strokeWidth={2} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">
                {missingPhotos} active student{missingPhotos === 1 ? " has" : "s have"} no photo
              </p>
              <p className="mt-0.5 text-xs text-pending">
                Invigilators can&apos;t visually verify identity without one. Add photos before exam day.
              </p>
            </div>
          </div>
          <Link
            href="/admin/students?missingPhoto=1"
            className="shrink-0 rounded-lg bg-pending px-3 py-2 text-center text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            Review students
          </Link>
        </motion.div>
      )}

      <motion.div
        variants={statCardContainer}
        initial="hidden"
        animate="show"
        className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <StatCard icon={Building2} label="Halls configured" value={totals.halls} detail="Venues on file" accent="#1a3c6e" />
        <StatCard icon={CalendarDays} label="Exams created" value={totals.exams} detail="This exam cycle" accent="#0f6e5c" />
        <StatCard
          icon={Users}
          label="Seats mapped"
          value={totals.seatsMapped}
          detail={totals.seatsCapacity > 0 ? `${utilization}% of ${totals.seatsCapacity} capacity` : "No hall capacity yet"}
          accent="#5b3ba0"
        />
        <StatCard icon={ShieldCheck} label="Invigilators" value={totals.invigilators} detail="Ready to scan" accent="#0e6ba8" />
      </motion.div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-charcoal">Upcoming exams</h2>
          <Link href="/admin/exams" className="text-sm font-semibold text-accent hover:text-accent-hover">
            View all
          </Link>
        </div>
        <div className="mt-3">
          <UpcomingExamsList exams={upcomingExams} />
        </div>
      </div>
    </div>
  );
}
