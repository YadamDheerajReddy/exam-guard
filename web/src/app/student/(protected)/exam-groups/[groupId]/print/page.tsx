import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudent } from "@/lib/student-context";
import { getExamGroupPass } from "../actions";
import { PrintButton } from "@/app/student/(protected)/exams/[examId]/print/print-button";
import { HallTicket } from "@/components/print/hall-ticket";
import { getHallTicketCustomization } from "@/lib/hall-ticket-customization";

export default async function ExamGroupPassPrintPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const student = await requireStudent();
  const service = createAdminClient();
  const [pass, orgResult] = await Promise.all([
    getExamGroupPass(groupId),
    service.from("organizations").select("name, logo_url").eq("id", student.organizationId).maybeSingle(),
  ]);
  const orgName = orgResult.data?.name ?? "ExamGuard";

  // This route only ever resolves for school orgs (getExamGroupPass rejects
  // any other org type above), so the logo doesn't need a type check here.
  let orgLogoUrl: string | null = null;
  if (orgResult.data?.logo_url) {
    const { data: signed } = await service.storage.from("org-logos").createSignedUrl(orgResult.data.logo_url, 300);
    orgLogoUrl = signed?.signedUrl ?? null;
  }
  const customization = await getHallTicketCustomization(service, student.organizationId);

  if (!pass.ok) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-slate">{pass.error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-10 print:bg-white print:p-0">
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      <PrintButton />

      <HallTicket
        orgName={orgName}
        orgLogoUrl={orgLogoUrl}
        customization={customization}
        title={pass.groupName}
        studentFullName={pass.studentFullName}
        studentRollNumber={pass.studentRollNumber}
        photoUrl={pass.photoUrl}
        exams={pass.exams.map((exam) => ({
          courseCode: exam.courseCode,
          courseTitle: exam.courseTitle,
          examDate: exam.examDate,
          startTime: exam.startTime,
          endTime: exam.endTime,
          hall: exam.hall,
          displayToken: exam.displayToken,
          completed: exam.completed,
        }))}
      />
    </main>
  );
}
