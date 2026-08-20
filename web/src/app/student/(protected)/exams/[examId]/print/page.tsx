import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudent } from "@/lib/student-context";
import { getExamPass } from "../actions";
import { PrintButton } from "./print-button";
import { HallTicket, type HallTicketCustomization } from "@/components/print/hall-ticket";
import { getHallTicketCustomization } from "@/lib/hall-ticket-customization";

export default async function ExamPassPrintPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const student = await requireStudent();
  const service = createAdminClient();
  const [pass, orgResult] = await Promise.all([
    getExamPass(examId),
    service.from("organizations").select("name, type, logo_url").eq("id", student.organizationId).maybeSingle(),
  ]);
  const orgName = orgResult.data?.name ?? "ExamGuard";

  // Logo and full customization only for school orgs on the printed
  // ticket, per spec — other org types keep the plain default look.
  let orgLogoUrl: string | null = null;
  let customization: HallTicketCustomization | null = null;
  if (orgResult.data?.type === "SCHOOL") {
    if (orgResult.data.logo_url) {
      const { data: signed } = await service.storage.from("org-logos").createSignedUrl(orgResult.data.logo_url, 300);
      orgLogoUrl = signed?.signedUrl ?? null;
    }
    customization = await getHallTicketCustomization(service, student.organizationId);
  }

  if (!pass.ok) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-slate">{pass.error}</p>
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

      <HallTicket
        orgName={orgName}
        orgLogoUrl={orgLogoUrl}
        customization={customization}
        studentFullName={pass.studentFullName}
        studentRollNumber={pass.studentRollNumber}
        photoUrl={pass.photoUrl}
        exams={[
          {
            courseCode: pass.courseCode,
            courseTitle: pass.courseTitle,
            examDate: pass.examDate,
            startTime: pass.startTime,
            endTime: pass.endTime,
            hall: pass.hall,
            displayToken: pass.displayToken,
            completed: pass.completed,
          },
        ]}
      />
    </main>
  );
}
