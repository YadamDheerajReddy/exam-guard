"use client";

import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";

export const statCardContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};

export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
  accent: string;
}) {
  return (
    <motion.div
      variants={item}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate">{label}</p>
        <div className="flex size-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}1a` }}>
          <Icon className="size-4" strokeWidth={2} style={{ color: accent }} />
        </div>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">{value.toLocaleString()}</p>
      <p className="mt-1 truncate text-xs text-slate">{detail}</p>
    </motion.div>
  );
}
