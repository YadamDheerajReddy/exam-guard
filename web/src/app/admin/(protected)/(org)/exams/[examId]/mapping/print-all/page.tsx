import { getAdminBulkHallTickets } from "../print-actions";
import { PrintButton } from "@/app/student/(protected)/exams/[examId]/print/print-button";
import { HallTicket } from "@/components/print/hall-ticket";

export default async function AdminBulkHallTicketPrintPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const result = await getAdminBulkHallTickets(examId);

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-slate">{result.error}</p>
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

      {/* No forced page-break per student — each ticket is compact enough
          (print:break-inside-avoid on its own root) to pack several onto
          one sheet, so a short ticket doesn't waste a whole page. */}
      <div className="flex flex-col gap-4 print:gap-2">
        {result.tickets.map((ticket, i) => (
          <HallTicket
            key={`${ticket.studentRollNumber}-${i}`}
            orgName={ticket.orgName}
            orgLogoUrl={ticket.orgLogoUrl}
            customization={ticket.customization}
            title={ticket.title}
            studentFullName={ticket.studentFullName}
            studentRollNumber={ticket.studentRollNumber}
            photoUrl={ticket.photoUrl}
            exams={ticket.exams}
          />
        ))}
      </div>
    </main>
  );
}
