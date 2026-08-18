"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getExamPass, type ExamPassResult } from "@/app/student/(protected)/exams/[examId]/actions";
import { CheckCircle2, Lock, MapPin } from "lucide-react";

const POLL_INTERVAL_MS = 60_000;
// Once reveal is due within this window, schedule a precise one-off check
// instead of waiting for the next regular poll — makes the unlock feel
// close to instant without needing an hours-long setTimeout for exams
// that are still far off.
const PRECISE_WINDOW_MS = POLL_INTERVAL_MS * 2;

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
  // eventually appears once an invigilator scans this pass.
  useEffect(() => {
    if (pass.ok && pass.checkedIn) return;
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pass.ok && pass.checkedIn]);

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

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-border bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate">
          {pass.examDate} · {pass.startTime}
        </p>
        <h1 className="mt-1 text-lg font-bold text-ink">{pass.courseCode}</h1>
        <p className="text-sm text-slate">{pass.courseTitle}</p>

        <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
          {pass.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not worth next/image remotePatterns config
            <img
              src={pass.photoUrl}
              alt=""
              className="h-14 w-14 rounded-lg object-cover"
            />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-surface" />
          )}
          <div>
            <p className="text-sm font-semibold text-charcoal">Self-verify at the hall entrance</p>
            <p className="text-xs text-slate">This photo should match your face.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col items-center gap-3 rounded-lg bg-surface p-6">
          <QRCodeSVG value={pass.displayToken} size={200} />
          <p className="text-center text-xs text-slate">
            This code refreshes automatically — a screenshot will stop
            scanning once it expires. Show the live screen at the door.
          </p>
        </div>
      </div>

      {pass.checkedIn ? (
        <div className="animate-in fade-in zoom-in-95 rounded-lg bg-verified-tint p-6 text-center transition-all duration-300">
          <CheckCircle2 className="mx-auto size-8 text-verified" strokeWidth={2} />
          <p className="mt-2 text-sm font-bold text-verified">Checked in</p>
          <p className="mt-1 text-xs text-verified">
            {pass.checkedInAt && new Date(pass.checkedInAt).toLocaleString()}
          </p>
        </div>
      ) : pass.revealed && pass.hall ? (
        <div className="animate-in fade-in zoom-in-95 rounded-lg bg-verified-tint p-6 text-center transition-all duration-300">
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
              <p className="mt-1 truncate font-mono text-xl font-extrabold leading-tight text-ink">{pass.hall.seatNumber}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-pending-tint p-6 text-center transition-all duration-300">
          <Lock className="mx-auto size-6 text-pending" strokeWidth={2} />
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-pending">Locked</p>
          <p className="mt-1 text-2xl font-bold text-ink">
            Unlocks in {formatCountdown(msUntilReveal)}
          </p>
          <p className="mt-1 text-xs text-pending">
            Hall and seat appear here automatically — no need to refresh.
          </p>
        </div>
      )}
    </div>
  );
}
