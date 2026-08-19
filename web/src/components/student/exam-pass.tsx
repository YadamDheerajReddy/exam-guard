"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { getExamPass, type ExamPassResult } from "@/app/student/(protected)/exams/[examId]/actions";
import { Logo } from "@/components/logo";
import { SeatMap } from "@/components/student/seat-map";
import { CalendarCheck, CheckCircle2, Lock, MapPin, Printer, ScanLine } from "lucide-react";

const POLL_INTERVAL_MS = 60_000;
// Once reveal is due within this window, schedule a precise one-off check
// instead of waiting for the next regular poll — makes the unlock feel
// close to instant without needing an hours-long setTimeout for exams
// that are still far off.
const PRECISE_WINDOW_MS = POLL_INTERVAL_MS * 2;
// Mirrors ROTATING_TOKEN_TTL_SECONDS in lib/barcode-token.ts — used only to
// animate the live-ring's countdown; the server is the actual authority on
// when a token expires, this is cosmetic.
const DISPLAY_TOKEN_WINDOW_MS = 90_000;

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

function PerforatedDivider() {
  return (
    <div className="relative h-0 border-t-2 border-dashed border-border">
      <div className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-surface" />
      <div className="absolute -right-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-surface" />
    </div>
  );
}

// The track traces a rounded square, not a circle: the QR is a 200px square
// (176px code + p-3), and a square only fits inside a circle whose diameter
// is its *diagonal* — 283px here — so a circular ring either clips the QR's
// corners or has to shrink the code below a comfortable scanning size.
// Hugging the QR's own shape keeps it large and doubles as a scan frame.
const RING_BOX = 232;
const RING_INSET = 8;
const RING_SIDE = RING_BOX - RING_INSET * 2;

function TokenRing({ progress }: { progress: number }) {
  const shared = {
    x: RING_INSET,
    y: RING_INSET,
    width: RING_SIDE,
    height: RING_SIDE,
    rx: 20,
    fill: "none",
    strokeWidth: 3,
  };
  return (
    <svg
      width={RING_BOX}
      height={RING_BOX}
      viewBox={`0 0 ${RING_BOX} ${RING_BOX}`}
      className="absolute inset-0"
      aria-hidden="true"
    >
      <rect {...shared} stroke="var(--color-border)" />
      {/* pathLength lets Framer Motion drive the dash math off a normalised
       * 0–1 length, so there's no hand-computed rounded-rect perimeter to
       * drift out of sync if the box or corner radius ever changes. */}
      <motion.rect
        {...shared}
        stroke="var(--color-accent)"
        strokeLinecap="round"
        // Explicit initial as well as animate: without it the first paint
        // (and any reduced-motion render, where the tween is skipped) draws
        // a full ring no matter how little of the token's life is left.
        initial={{ pathLength: progress }}
        animate={{ pathLength: progress }}
        transition={{ duration: 0.3, ease: "linear" }}
      />
    </svg>
  );
}

export function ExamPass({ examId, initial }: { examId: string; initial: ExamPassResult }) {
  const [pass, setPass] = useState(initial);
  const [nowMs, setNowMs] = useState(() => Date.now());

  async function refresh() {
    const result = await getExamPass(examId);
    setPass(result);
  }

  // Ticks the visible countdown every second — display only. The actual
  // unlock decision is only ever made server-side, on each refresh() call.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Regular background poll — also how the barcode rotates (a fresh
  // displayToken comes back on every call) and how "checked in" status
  // eventually appears once an invigilator scans this pass. Stops once the
  // pass is settled: checked in, or the exam window has closed and no
  // further token will ever be minted.
  const settled = pass.ok && (pass.checkedIn || pass.completed);
  useEffect(() => {
    if (settled) return;
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  // Precise one-off check right at the reveal moment, once it's close.
  // Self-correcting even if this fires a little early/late or the client
  // clock is off — the server re-decides for real on every call.
  useEffect(() => {
    if (!pass.ok || pass.revealed) return;
    const msUntilReveal = new Date(pass.revealAt).getTime() - Date.now();
    if (msUntilReveal > PRECISE_WINDOW_MS) return;
    const timer = setTimeout(refresh, Math.max(0, msUntilReveal) + 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pass]);

  if (!pass.ok) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center">
        <p className="text-sm text-slate">{pass.error}</p>
      </div>
    );
  }

  const msUntilReveal = new Date(pass.revealAt).getTime() - nowMs;
  const msUntilTokenExpiry = pass.displayTokenExpiresAt
    ? Math.max(0, new Date(pass.displayTokenExpiresAt).getTime() - nowMs)
    : 0;
  const tokenProgress = Math.min(1, msUntilTokenExpiry / DISPLAY_TOKEN_WINDOW_MS);

  // A finished exam outranks everything else — hall/seat and the reveal
  // countdown are both moot once the window has closed. "Checked in" still
  // wins over a plain "ended" though: it's the more useful record of what
  // actually happened to the student.
  const statusKey = pass.checkedIn
    ? "checked-in"
    : pass.completed
      ? "completed"
      : pass.revealed && pass.hall
        ? "revealed"
        : "locked";

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
              Exam pass
            </span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/70">
            {pass.examDate} · {pass.startTime}
          </p>
          <h1 className="mt-0.5 text-xl font-extrabold leading-tight">{pass.courseCode}</h1>
          <p className="text-sm text-white/85">{pass.courseTitle}</p>
        </div>

        <div className="flex items-center gap-3 px-6 py-4">
          {pass.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not worth next/image remotePatterns config
            <img
              src={pass.photoUrl}
              alt=""
              className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-sm"
            />
          ) : (
            <div className="h-14 w-14 rounded-full border-2 border-white bg-surface shadow-sm" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-charcoal">Self-verify at the hall entrance</p>
            <p className="text-xs text-slate">This photo should match your face.</p>
          </div>
        </div>

        <PerforatedDivider />

        {pass.displayToken ? (
          <div className="flex flex-col items-center gap-3 px-6 py-6">
            {pass.isStaticPass ? (
              <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-border">
                <QRCodeSVG value={pass.displayToken} size={200} />
              </div>
            ) : (
              <div className="relative flex size-[232px] items-center justify-center">
                <TokenRing progress={tokenProgress} />
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <QRCodeSVG value={pass.displayToken} size={176} />
                </div>
              </div>
            )}
            {pass.isStaticPass ? (
              <>
                <p className="text-center text-xs text-slate">
                  This code stays valid through the exam — print it and bring the printed copy to the hall.
                </p>
                <Link
                  href={`/student/exams/${examId}/print`}
                  target="_blank"
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                >
                  <Printer className="size-4" strokeWidth={2} />
                  Print pass
                </Link>
              </>
            ) : (
              <p className="text-center text-xs text-slate">
                This code refreshes automatically — a screenshot will stop scanning once it expires. Show the live
                screen at the door.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-surface">
              <CalendarCheck className="size-7 text-slate" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-bold text-ink">This pass has expired</p>
            <p className="max-w-xs text-xs text-slate">
              {pass.courseCode} ended at {pass.endTime}. Passes stop working once the exam window closes.
            </p>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {statusKey === "checked-in" ? (
          <motion.div
            key="checked-in"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl bg-verified-tint p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
            >
              <CheckCircle2 className="mx-auto size-9 text-verified" strokeWidth={2} />
            </motion.div>
            <p className="mt-2 text-sm font-bold text-verified">Checked in</p>
            <p className="mt-1 text-xs text-verified">
              {pass.checkedInAt && new Date(pass.checkedInAt).toLocaleString()}
            </p>
          </motion.div>
        ) : statusKey === "completed" ? (
          <motion.div
            key="completed"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl bg-inactive-tint p-6 text-center"
          >
            <CalendarCheck className="mx-auto size-7 text-inactive" strokeWidth={2} />
            <p className="mt-2 text-sm font-bold text-inactive">Exam completed</p>
            <p className="mt-1 text-xs text-inactive">
              You weren&apos;t checked in for this exam. Contact your exam department if that looks wrong.
            </p>
          </motion.div>
        ) : statusKey === "revealed" && pass.hall ? (
          <motion.div
            key="revealed"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl bg-verified-tint p-6 text-center"
          >
            <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-verified">
              <MapPin className="size-3.5" strokeWidth={2} />
              Hall &amp; seat
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-verified">Building</p>
                <p className="mt-1 truncate text-xl font-extrabold leading-tight text-ink">{pass.hall.buildingName}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-verified">Room No.</p>
                <p className="mt-1 truncate text-xl font-extrabold leading-tight text-ink">{pass.hall.roomNumber}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-verified">Seat No.</p>
                <p className="mt-1 truncate font-mono text-xl font-extrabold leading-tight text-ink">
                  {pass.hall.seatNumber}
                </p>
              </div>
            </div>

            <SeatMap seatNumber={pass.hall.seatNumber} capacity={pass.hall.capacity} />
          </motion.div>
        ) : (
          <motion.div
            key="locked"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl bg-pending-tint p-6 text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Lock className="mx-auto size-6 text-pending" strokeWidth={2} />
            </motion.div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-pending">Locked</p>
            <p className="mt-1 text-2xl font-bold text-ink">Unlocks in {formatCountdown(msUntilReveal)}</p>
            <p className="mt-1 text-xs text-pending">Hall and seat appear here automatically — no need to refresh.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
