import { getAdminHallTicketForMapping } from "../../print-actions";
import { PrintButton } from "@/app/student/(protected)/exams/[examId]/print/print-button";
import { HallTicket } from "@/components/print/hall-ticket";

export default async function AdminHallTicketPrintPage({
  params,
}: {
  params: Promise<{ mappingId: string }>;
}) {
  const { mappingId } = await params;
  const ticket = await getAdminHallTicketForMapping(mappingId);

  if (!ticket.ok) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-slate">{ticket.error}</p>
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
        orgName={ticket.orgName}
        orgLogoUrl={ticket.orgLogoUrl}
        customization={ticket.customization}
        title={ticket.title}
        studentFullName={ticket.studentFullName}
        studentRollNumber={ticket.studentRollNumber}
        photoUrl={ticket.photoUrl}
        exams={ticket.exams}
      />
    </main>
  );
}
