import { QRCodeSVG } from "qrcode.react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudent } from "@/lib/student-context";
import { getExamPass } from "../actions";
import { PrintButton } from "./print-button";
import { Logo } from "@/components/logo";
import { AlertTriangle } from "lucide-react";

export default async function ExamPassPrintPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const student = await requireStudent();
  const [pass, orgResult] = await Promise.all([
    getExamPass(examId),
    createAdminClient().from("organizations").select("name").eq("id", student.organizationId).maybeSingle(),
  ]);
  const orgName = orgResult.data?.name ?? "ExamGuard";

  if (!pass.ok) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-slate">{pass.error}</p>
      </main>
    );
  }

  if (!pass.displayToken) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-slate">
          {pass.completed
            ? `This pass has expired — ${pass.courseCode} ended at ${pass.endTime}.`
            : "This pass isn't ready to print yet."}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-10 print:bg-white print:p-0">
      {/* @page controls the physical sheet; .no-print hides the on-screen-only
          trigger button when the browser actually prints, so the printout
          is just the pass card, nothing else. */}
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      <PrintButton />

      <div className="mx-auto max-w-md rounded-2xl border-2 border-ink/10 bg-white p-8 shadow-sm print:mx-0 print:max-w-none print:rounded-none print:border-2 print:border-black print:shadow-none">
        <div className="flex items-center justify-between border-b-2 border-dashed border-border pb-4">
          <div className="flex items-center gap-2">
            <Logo size={22} withWordmark={false} />
            <div>
              <p className="text-sm font-bold text-ink">{orgName}</p>
              <p className="text-xs uppercase tracking-wide text-slate">Exam Pass</p>
            </div>
          </div>
          {pass.hall && (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate">Seat</p>
              <p className="font-mono text-lg font-extrabold text-ink">{pass.hall.seatNumber}</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-start gap-4">
          {pass.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, rendered once at print time
            <img
              src={pass.photoUrl}
              alt=""
              className="h-24 w-24 shrink-0 rounded-lg border border-border object-cover print:border-black"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface text-[10px] text-slate print:border-black">
              No photo
            </div>
          )}
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight text-ink">{pass.studentFullName}</p>
            <p className="mt-0.5 font-mono text-sm text-charcoal">{pass.studentRollNumber}</p>
            <p className="mt-3 text-sm font-bold text-ink">{pass.courseCode}</p>
            <p className="text-sm text-charcoal">{pass.courseTitle}</p>
            <p className="mt-1 text-xs text-slate">
              {pass.examDate} · {pass.startTime}–{pass.endTime}
            </p>
          </div>
        </div>

        {pass.hall ? (
          <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg bg-surface p-3 text-center print:bg-white print:border print:border-black">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate">Building</p>
              <p className="text-sm font-bold text-ink">{pass.hall.buildingName}</p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate">Room</p>
              <p className="text-sm font-bold text-ink">{pass.hall.roomNumber}</p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate">Seat</p>
              <p className="font-mono text-sm font-bold text-ink">{pass.hall.seatNumber}</p>
            </div>
          </div>
        ) : (
          <p className="mt-5 flex items-center gap-1.5 rounded-lg bg-pending-tint p-3 text-xs text-pending print:bg-white print:border print:border-black print:text-black">
            <AlertTriangle className="size-3.5 shrink-0" strokeWidth={2} />
            Hall and seat hadn&apos;t been revealed yet when this was printed — reprint closer to the exam.
          </p>
        )}

        <div className="mt-6 flex flex-col items-center gap-2 border-t-2 border-dashed border-border pt-6">
          <QRCodeSVG value={pass.displayToken} size={220} />
          <p className="mt-1 text-center text-[11px] leading-relaxed text-slate">
            Present this printed pass with a valid photo ID at the exam hall entrance. This code is scanned once
            for entry.
          </p>
        </div>
      </div>
    </main>
  );
}
