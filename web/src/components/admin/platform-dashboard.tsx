"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, GraduationCap, Plus, ShieldCheck, UserCog } from "lucide-react";
import { OrgList, type Org } from "@/components/admin/org-list";
import { OrgCreateDrawer } from "@/components/admin/org-create-drawer";
import { StatCard, statCardContainer } from "@/components/admin/stat-card";

type Totals = {
  organizations: number;
  active: number;
  onHold: number;
  admins: number;
  students: number;
  invigilators: number;
  exams: number;
  halls: number;
};

export function PlatformDashboard({ orgs, totals }: { orgs: Org[]; totals: Totals }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Platform overview</h1>
          <p className="mt-1 text-sm text-slate">Every institution running on ExamGuard, in one place.</p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          New organization
        </button>
      </div>

      <motion.div
        variants={statCardContainer}
        initial="hidden"
        animate="show"
        className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <StatCard
          icon={Building2}
          label="Organizations"
          value={totals.organizations}
          detail={`${totals.active} active · ${totals.onHold} on hold`}
          accent="#1a3c6e"
        />
        <StatCard icon={UserCog} label="Admins" value={totals.admins} detail="Across all institutions" accent="#5b3ba0" />
        <StatCard
          icon={GraduationCap}
          label="Students"
          value={totals.students}
          detail={`${totals.exams} exam${totals.exams === 1 ? "" : "s"} scheduled`}
          accent="#0f6e5c"
        />
        <StatCard
          icon={ShieldCheck}
          label="Invigilators"
          value={totals.invigilators}
          detail={`${totals.halls} hall${totals.halls === 1 ? "" : "s"} configured`}
          accent="#0e6ba8"
        />
      </motion.div>

      <div className="mt-8">
        <OrgList orgs={orgs} />
      </div>

      <OrgCreateDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
