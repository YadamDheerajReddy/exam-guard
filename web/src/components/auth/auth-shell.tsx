"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { ScanVisual } from "./scan-visual";
import { Logo } from "@/components/logo";

const panelVariants = {
  hidden: { opacity: 0, x: -16 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

const formVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } },
};

export const fieldVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};

export function AuthShell({
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  tagline,
  children,
}: {
  eyebrow: string;
  eyebrowIcon: LucideIcon;
  tagline: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-stretch overflow-hidden">
      <motion.div
        variants={panelVariants}
        initial="hidden"
        animate="show"
        className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#122c56] via-accent to-[#0d7ce0] px-10 py-12 lg:flex"
      >
        <div className="flex items-center gap-2 text-white">
          <EyebrowIcon className="size-4" strokeWidth={2} />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">{eyebrow}</span>
        </div>

        <div className="mx-auto w-full max-w-[280px]">
          <ScanVisual />
        </div>

        <p className="max-w-xs text-sm leading-relaxed text-white/70">{tagline}</p>
      </motion.div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <motion.div variants={formVariants} initial="hidden" animate="show" className="w-full max-w-sm">
          <div className="mb-2 lg:hidden">
            <Logo size={28} />
          </div>
          {children}
          <p className="mt-6 text-center text-xs text-slate">
            By continuing you agree to our{" "}
            <Link href="/privacy" target="_blank" className="font-semibold text-accent hover:text-accent-hover">
              Privacy Policy
            </Link>
            .
          </p>
        </motion.div>
      </div>
    </main>
  );
}
