import { QRCodeSVG } from "qrcode.react";
import { Logo } from "@/components/logo";

export type HallTicketExamBlock = {
  courseCode: string;
  courseTitle: string;
  examDate: string;
  startTime: string;
  endTime: string;
  hall: { buildingName: string; roomNumber: string; seatNumber: string } | null;
  displayToken: string | null;
  completed: boolean;
};

export type HallTicketSignature = { url: string | null; label: string };

export type HallTicketBorderStyle = "solid" | "double" | "dashed" | "none";
export type HallTicketHeaderLayout = "centered" | "left";

export type HallTicketCustomization = {
  headerText?: string | null;
  footerNote?: string | null;
  letterText?: string | null;
  showAddress?: boolean | null;
  primaryColor?: string | null;
  font?: string | null;
  borderStyle?: HallTicketBorderStyle | null;
  headerLayout?: HallTicketHeaderLayout | null;
  logoSize?: number | null;
  headerBgColor?: string | null;
  headerBgGradientTo?: string | null;
  orgNameColor?: string | null;
  signatures?: HallTicketSignature[];
  address?: string | null;
};

export const HALL_TICKET_LOGO_SIZE_MIN = 24;
export const HALL_TICKET_LOGO_SIZE_MAX = 96;
export const HALL_TICKET_LOGO_SIZE_DEFAULT = 36;

// Curated rather than free-text — a print target needs fonts every browser
// actually has, and this is also the single source of truth for the
// dropdown in the settings customizer, so the two can't drift apart.
export const HALL_TICKET_FONT_OPTIONS = [
  { value: "default", label: "Default (system)", stack: "" },
  { value: "serif-classic", label: "Classic serif", stack: "Georgia, 'Times New Roman', serif" },
  { value: "serif-elegant", label: "Elegant serif", stack: "'Palatino Linotype', 'Book Antiqua', Georgia, serif" },
  { value: "sans-modern", label: "Modern sans", stack: "Arial, Helvetica, sans-serif" },
  { value: "sans-clean", label: "Clean sans", stack: "Verdana, Geneva, sans-serif" },
  { value: "mono", label: "Monospace", stack: "'Courier New', Courier, monospace" },
] as const;

export const HALL_TICKET_BORDER_OPTIONS: { value: HallTicketBorderStyle; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "double", label: "Double" },
  { value: "dashed", label: "Dashed" },
  { value: "none", label: "None" },
];

export const HALL_TICKET_LAYOUT_OPTIONS: { value: HallTicketHeaderLayout; label: string }[] = [
  { value: "centered", label: "Centered" },
  { value: "left", label: "Left-aligned" },
];

// Five one-click starting points — each just pre-fills the same
// color/font/border/layout fields the admin can already edit individually,
// rather than a separate structural template system, so "pick a template"
// and "customize from scratch" are the same underlying mechanism and never
// drift apart. Text content (header, letter, footer, signatures) is
// deliberately untouched by a template, since that's org-specific wording
// no preset should overwrite.
export const HALL_TICKET_TEMPLATES: {
  id: string;
  label: string;
  primaryColor: string;
  font: string;
  borderStyle: HallTicketBorderStyle;
  headerLayout: HallTicketHeaderLayout;
}[] = [
  { id: "classic", label: "Classic", primaryColor: "#10131a", font: "default", borderStyle: "solid", headerLayout: "centered" },
  { id: "formal-navy", label: "Formal Navy", primaryColor: "#1a3c6e", font: "serif-classic", borderStyle: "double", headerLayout: "centered" },
  { id: "modern-minimal", label: "Modern Minimal", primaryColor: "#10131a", font: "sans-modern", borderStyle: "none", headerLayout: "left" },
  { id: "elegant-maroon", label: "Elegant Maroon", primaryColor: "#7a1f2b", font: "serif-elegant", borderStyle: "solid", headerLayout: "centered" },
  { id: "compact-mono", label: "Compact Mono", primaryColor: "#10131a", font: "mono", borderStyle: "dashed", headerLayout: "left" },
];

const DEFAULT_COLOR = "#10131a";

function fontStackFor(font: string | null | undefined): string {
  return HALL_TICKET_FONT_OPTIONS.find((f) => f.value === font)?.stack ?? "";
}

function borderClassFor(style: HallTicketBorderStyle | null | undefined): string {
  switch (style) {
    case "double":
      return "border-4 border-double";
    case "dashed":
      return "border-2 border-dashed";
    case "none":
      return "border-0";
    default:
      return "border-2 border-solid";
  }
}

// 96px ≈ 25.4mm (1in) at the browser's 96 CSS-px/inch mapping — comfortably
// above the ~20mm floor commonly cited for reliable handheld QR scanning.
// The 52px used before that was ~13.8mm, too small for the invigilator
// app's camera to resolve the token's module pattern reliably at a normal
// scanning distance, hence the reported scan failures.
const QR_SIZE = 96;

// Single source of truth for every printed pass in the app — a lone exam
// (student self-print), a whole exam group consolidated onto one sheet
// (student self-print), or an admin printing on a student's behalf, single
// or bulk — plus the settings page's live customization preview, which
// renders this exact component against sample data. All differ only in
// which exam blocks and customization values they pass in.
//
// Laid out as a plain bordered table, one row per exam, rather than a
// repeated card — a card per exam (with its own padding/border/shadow)
// couldn't fit more than 2-3 exams per printed page; this table still
// comfortably fits 7+ rows on an A4 sheet even with a header and a
// full-size QR, since each row only needs to be as tall as its QR code.
export function HallTicket({
  orgName,
  orgLogoUrl,
  title = "Exam Pass",
  studentFullName,
  studentRollNumber,
  photoUrl,
  exams,
  customization,
}: {
  orgName: string;
  orgLogoUrl?: string | null;
  title?: string;
  studentFullName: string;
  studentRollNumber: string;
  photoUrl: string | null;
  exams: HallTicketExamBlock[];
  customization?: HallTicketCustomization | null;
}) {
  const accent = customization?.primaryColor || DEFAULT_COLOR;
  const fontStack = fontStackFor(customization?.font);
  const headerText = customization?.headerText?.trim() || title;
  const footerNote =
    customization?.footerNote?.trim() ||
    "Present this ticket with a valid photo ID at the exam hall entrance. Each code is scanned once for entry.";
  const letterText = customization?.letterText?.trim();
  const showAddress = Boolean(customization?.showAddress && customization?.address?.trim());
  const borderClass = borderClassFor(customization?.borderStyle);
  const centered = (customization?.headerLayout ?? "centered") === "centered";
  const signatures = (customization?.signatures ?? []).filter((s) => s.url || s.label.trim());

  const logoSize = Math.min(
    HALL_TICKET_LOGO_SIZE_MAX,
    Math.max(HALL_TICKET_LOGO_SIZE_MIN, customization?.logoSize || HALL_TICKET_LOGO_SIZE_DEFAULT),
  );

  // A header background is opted into deliberately, so the header's own
  // text switches to white for contrast rather than staying whatever the
  // border/org-name accent color happens to be — picking a bg color close
  // to that accent would otherwise make the org name unreadable against it.
  const headerBgStyle: React.CSSProperties = {};
  if (customization?.headerBgColor) {
    headerBgStyle.backgroundImage = customization.headerBgGradientTo
      ? `linear-gradient(135deg, ${customization.headerBgColor}, ${customization.headerBgGradientTo})`
      : undefined;
    headerBgStyle.backgroundColor = customization.headerBgColor;
    // Printers skip background colors/images by default to save ink unless
    // told otherwise — without this the header bg would show on screen but
    // silently vanish from the actual printed sheet.
    headerBgStyle.WebkitPrintColorAdjust = "exact";
    headerBgStyle.printColorAdjust = "exact";
  }
  const hasHeaderBg = Boolean(customization?.headerBgColor);
  // Auto-picks white-on-background or the accent color otherwise, but an
  // explicit orgNameColor always wins — the auto behavior exists only so a
  // header background doesn't make the org name unreadable by default, not
  // to prevent an admin from choosing, say, a colored name on a white header.
  const resolvedOrgNameColor = customization?.orgNameColor || (hasHeaderBg ? "#ffffff" : accent);
  const headerSubtextClass = hasHeaderBg ? "text-white/80" : "text-slate";

  const logo = orgLogoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, rendered once at print time
    <img src={orgLogoUrl} alt="" style={{ height: logoSize, width: logoSize }} className="shrink-0 object-contain" />
  ) : (
    <Logo size={logoSize} withWordmark={false} inverted={hasHeaderBg} />
  );

  return (
    <div
      className={`mx-auto max-w-2xl ${borderClass} print:mx-0 print:max-w-none print:break-inside-avoid`}
      style={{ borderColor: accent, fontFamily: fontStack || undefined }}
    >
      {centered ? (
        <div
          className="flex flex-col items-center gap-1 border-b-2 px-3 py-3 text-center"
          style={{ borderColor: accent, ...headerBgStyle }}
        >
          {logo}
          <p className="text-base font-bold" style={{ color: resolvedOrgNameColor }}>
            {orgName}
          </p>
          {showAddress && <p className={`max-w-md text-[10px] ${headerSubtextClass}`}>{customization!.address}</p>}
          <p className={`text-xs font-semibold uppercase tracking-wide ${headerSubtextClass}`}>{headerText}</p>
        </div>
      ) : (
        <div
          className="flex items-center justify-between gap-3 border-b-2 px-3 py-3"
          style={{ borderColor: accent, ...headerBgStyle }}
        >
          <div className="flex items-center gap-2">
            {logo}
            <div>
              <p className="text-base font-bold" style={{ color: resolvedOrgNameColor }}>
                {orgName}
              </p>
              {showAddress && <p className={`max-w-xs text-[10px] ${headerSubtextClass}`}>{customization!.address}</p>}
            </div>
          </div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${headerSubtextClass}`}>{headerText}</p>
        </div>
      )}

      {letterText && (
        <p className="border-b border-ink/20 px-3 py-2 text-[10px] italic leading-relaxed text-charcoal">{letterText}</p>
      )}

      <div className="flex items-center gap-3 border-b border-ink/20 px-3 py-2">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, rendered once at print time
          <img src={photoUrl} alt="" className="h-12 w-12 shrink-0 rounded border border-border object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-dashed border-border bg-surface text-[8px] text-slate">
            No photo
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-extrabold leading-tight text-ink">{studentFullName}</p>
          <p className="font-mono text-xs text-charcoal">{studentRollNumber}</p>
        </div>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-ink/20 bg-surface text-left text-[9px] font-semibold uppercase tracking-wide text-slate">
            <th className="px-2 py-1.5">Course</th>
            <th className="px-2 py-1.5">Date &amp; time</th>
            <th className="px-2 py-1.5">Hall</th>
            <th className="px-2 py-1.5">Seat</th>
            <th className="w-28 px-2 py-1.5">Code</th>
          </tr>
        </thead>
        <tbody>
          {exams.map((exam, i) => (
            <tr key={`${exam.courseCode}-${i}`} className="border-b border-ink/20 last:border-b-0">
              <td className="px-2 py-1.5 align-middle">
                <p className="font-bold text-ink">{exam.courseCode}</p>
                <p className="text-[10px] text-slate">{exam.courseTitle}</p>
              </td>
              <td className="px-2 py-1.5 align-middle text-charcoal">
                <p>{exam.examDate}</p>
                <p className="text-[10px] text-slate">
                  {exam.startTime}–{exam.endTime}
                </p>
              </td>
              <td className="px-2 py-1.5 align-middle text-charcoal">
                {exam.hall ? (
                  <>
                    <p>{exam.hall.buildingName}</p>
                    <p className="text-[10px] text-slate">Room {exam.hall.roomNumber}</p>
                  </>
                ) : (
                  <p className="text-[10px] text-pending">Not yet revealed</p>
                )}
              </td>
              <td className="px-2 py-1.5 align-middle font-mono font-bold text-ink">
                {exam.hall?.seatNumber ?? "—"}
              </td>
              <td className="px-2 py-1.5 align-middle">
                {exam.displayToken ? (
                  <QRCodeSVG value={exam.displayToken} size={QR_SIZE} />
                ) : (
                  <span className="text-[9px] text-slate">Expired</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {signatures.length > 0 && (
        <div className="flex justify-around gap-4 border-t border-ink/20 px-3 py-3">
          {signatures.map((sig, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              {sig.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, rendered once at print time
                <img src={sig.url} alt="" className="h-10 max-w-32 object-contain" />
              ) : (
                <div className="h-10" />
              )}
              <div className="w-28 border-t border-ink/40" />
              <p className="text-[9px] text-slate">{sig.label || "Signature"}</p>
            </div>
          ))}
        </div>
      )}

      <p className="border-t border-ink/20 px-3 py-1.5 text-[9px] leading-relaxed text-slate">{footerNote}</p>
    </div>
  );
}
