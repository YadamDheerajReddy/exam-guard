"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveHallTicketCustomization,
  saveHallTicketTemplate,
  applyHallTicketTemplate,
  deleteHallTicketTemplate,
  type HallTicketTemplateRow,
} from "@/app/admin/(protected)/(org)/settings/actions";
import {
  HallTicket,
  HALL_TICKET_FONT_OPTIONS,
  HALL_TICKET_BORDER_OPTIONS,
  HALL_TICKET_LAYOUT_OPTIONS,
  HALL_TICKET_TEMPLATES,
  HALL_TICKET_LOGO_SIZE_MIN,
  HALL_TICKET_LOGO_SIZE_MAX,
  HALL_TICKET_LOGO_SIZE_DEFAULT,
  type HallTicketExamBlock,
  type HallTicketBorderStyle,
  type HallTicketHeaderLayout,
} from "@/components/print/hall-ticket";
import { AlertCircle, CheckCircle2, Trash2, Upload } from "lucide-react";

const DEFAULT_COLOR = "#10131a";
const DEFAULT_GRADIENT_TO = "#0d7ce0";
type HeaderBgMode = "none" | "solid" | "gradient";

const SAMPLE_EXAMS: HallTicketExamBlock[] = [
  {
    courseCode: "CS101",
    courseTitle: "Introduction to Computer Science",
    examDate: "2026-08-24",
    startTime: "10:00:00",
    endTime: "13:00:00",
    hall: { buildingName: "Main Block", roomNumber: "204", seatNumber: "12" },
    displayToken: "PREVIEW",
    completed: false,
  },
  {
    courseCode: "MATH101",
    courseTitle: "Mathematics",
    examDate: "2026-08-25",
    startTime: "10:00:00",
    endTime: "13:00:00",
    hall: { buildingName: "Main Block", roomNumber: "204", seatNumber: "12" },
    displayToken: "PREVIEW",
    completed: false,
  },
];

export type HallTicketCustomizerInitial = {
  orgName: string;
  orgLogoUrl: string | null;
  orgAddress: string;
  headerText: string;
  footerNote: string;
  letterText: string;
  showAddress: boolean;
  primaryColor: string;
  font: string;
  borderStyle: HallTicketBorderStyle | null;
  headerLayout: HallTicketHeaderLayout | null;
  logoSize: number | null;
  headerBgColor: string;
  headerBgGradientTo: string;
  orgNameColor: string;
  signature1Label: string;
  signature1Url: string | null;
  signature2Label: string;
  signature2Url: string | null;
};

function SignatureSlot({
  slotLabel,
  label,
  onLabelChange,
  url,
  onSelect,
  onRemove,
  disabled,
}: {
  slotLabel: string;
  label: string;
  onLabelChange: (v: string) => void;
  url: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const inputId = `signature-${slotLabel.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate">{slotLabel}</p>
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URL or signed Supabase Storage URL
          <img src={url} alt="" className="h-10 w-20 rounded border border-border object-contain p-1" />
        ) : (
          <div className="flex h-10 w-20 items-center justify-center rounded border border-dashed border-border bg-surface text-[9px] text-slate">
            No image
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={inputId}
            className="flex w-fit cursor-pointer items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-charcoal transition-colors hover:bg-surface"
          >
            <Upload className="size-3 shrink-0" strokeWidth={2} />
            {url ? "Replace" : "Upload"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onSelect(file);
              e.target.value = "";
            }}
          />
          {url && (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="flex w-fit items-center gap-1 text-[11px] font-semibold text-alert disabled:opacity-50"
            >
              <Trash2 className="size-3" strokeWidth={2} />
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        placeholder="e.g. Principal"
        className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
      />
    </div>
  );
}

export function HallTicketCustomizer({
  initial,
  templates,
}: {
  initial: HallTicketCustomizerInitial;
  templates: HallTicketTemplateRow[];
}) {
  const router = useRouter();
  const [headerText, setHeaderText] = useState(initial.headerText);
  const [footerNote, setFooterNote] = useState(initial.footerNote);
  const [letterText, setLetterText] = useState(initial.letterText);
  const [showAddress, setShowAddress] = useState(initial.showAddress);
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor || DEFAULT_COLOR);
  const [font, setFont] = useState(initial.font || "default");
  const [borderStyle, setBorderStyle] = useState<HallTicketBorderStyle>(initial.borderStyle ?? "solid");
  const [headerLayout, setHeaderLayout] = useState<HallTicketHeaderLayout>(initial.headerLayout ?? "centered");
  const [logoSize, setLogoSize] = useState(initial.logoSize ?? HALL_TICKET_LOGO_SIZE_DEFAULT);

  const [headerBgMode, setHeaderBgMode] = useState<HeaderBgMode>(
    initial.headerBgColor ? (initial.headerBgGradientTo ? "gradient" : "solid") : "none",
  );
  const [headerBgColor, setHeaderBgColor] = useState(initial.headerBgColor || DEFAULT_COLOR);
  const [headerBgGradientTo, setHeaderBgGradientTo] = useState(initial.headerBgGradientTo || DEFAULT_GRADIENT_TO);

  const [orgNameColorMode, setOrgNameColorMode] = useState<"auto" | "custom">(initial.orgNameColor ? "custom" : "auto");
  const [orgNameColor, setOrgNameColor] = useState(initial.orgNameColor || DEFAULT_COLOR);

  const [sig1Label, setSig1Label] = useState(initial.signature1Label);
  const [sig1Url, setSig1Url] = useState(initial.signature1Url);
  const [sig1File, setSig1File] = useState<File | null>(null);
  const [sig1Removed, setSig1Removed] = useState(false);

  const [sig2Label, setSig2Label] = useState(initial.signature2Label);
  const [sig2Url, setSig2Url] = useState(initial.signature2Url);
  const [sig2File, setSig2File] = useState<File | null>(null);
  const [sig2Removed, setSig2Removed] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const [templateName, setTemplateName] = useState("");
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [templatePending, startTemplateTransition] = useTransition();

  // Nothing here touches the server until Save — file selection just swaps
  // in a local object URL so the preview updates instantly, matching the
  // "preview before saving" ask; only handleSave ever uploads anything.
  function touch() {
    setSaved(false);
    setError(null);
  }

  // A template is just a one-click way to set the same color/font/border/
  // layout fields below to a curated combination — it never touches
  // header/footer/letter text or signatures, since that's the org's own
  // wording, not something a preset should overwrite. Picking a template
  // and then editing any of these fields by hand is exactly "customize
  // from scratch" — there's no separate mode to fall out of.
  function applyTemplate(t: (typeof HALL_TICKET_TEMPLATES)[number]) {
    setPrimaryColor(t.primaryColor);
    setFont(t.font);
    setBorderStyle(t.borderStyle);
    setHeaderLayout(t.headerLayout);
    touch();
  }

  // Unlike the built-in quick-start presets, a saved template carries the
  // full design — text included — since it's the admin's own named,
  // reusable snapshot. Loading it only updates the editor; Save changes
  // still has to be clicked to make it the live configuration.
  function loadSavedTemplate(t: HallTicketTemplateRow) {
    setHeaderText(t.headerText ?? "");
    setFooterNote(t.footerNote ?? "");
    setLetterText(t.letterText ?? "");
    setShowAddress(t.showAddress);
    setPrimaryColor(t.primaryColor || DEFAULT_COLOR);
    setFont(t.font || "default");
    setBorderStyle((t.borderStyle as HallTicketBorderStyle) || "solid");
    setHeaderLayout((t.headerLayout as HallTicketHeaderLayout) || "centered");
    setLogoSize(t.logoSize ?? HALL_TICKET_LOGO_SIZE_DEFAULT);
    setHeaderBgMode(t.headerBgColor ? (t.headerBgGradientTo ? "gradient" : "solid") : "none");
    setHeaderBgColor(t.headerBgColor || DEFAULT_COLOR);
    setHeaderBgGradientTo(t.headerBgGradientTo || DEFAULT_GRADIENT_TO);
    setOrgNameColorMode(t.orgNameColor ? "custom" : "auto");
    setOrgNameColor(t.orgNameColor || DEFAULT_COLOR);
    touch();
  }

  function handleSaveTemplate() {
    setTemplateError(null);
    setTemplateSaved(false);
    if (!templateName.trim()) {
      setTemplateError("Enter a name for this template.");
      return;
    }
    const formData = new FormData();
    formData.set("name", templateName.trim());
    formData.set("headerText", headerText);
    formData.set("footerNote", footerNote);
    formData.set("letterText", letterText);
    formData.set("showAddress", showAddress ? "true" : "false");
    formData.set("primaryColor", primaryColor);
    formData.set("font", font);
    formData.set("borderStyle", borderStyle);
    formData.set("headerLayout", headerLayout);
    formData.set("logoSize", String(logoSize));
    formData.set("headerBgColor", headerBgMode === "none" ? "" : headerBgColor);
    formData.set("headerBgGradientTo", headerBgMode === "gradient" ? headerBgGradientTo : "");
    formData.set("orgNameColor", orgNameColorMode === "custom" ? orgNameColor : "");

    startTemplateTransition(async () => {
      const result = await saveHallTicketTemplate(formData);
      if (!result.ok) {
        setTemplateError(result.error);
        return;
      }
      setTemplateName("");
      setTemplateSaved(true);
      router.refresh();
    });
  }

  function handleApplyTemplate(id: string) {
    setTemplateError(null);
    startTemplateTransition(async () => {
      const result = await applyHallTicketTemplate(id);
      if (result.error) {
        setTemplateError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDeleteTemplate(id: string) {
    setTemplateError(null);
    startTemplateTransition(async () => {
      const result = await deleteHallTicketTemplate(id);
      setDeletingTemplateId(null);
      if (result.error) {
        setTemplateError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleSave() {
    setError(null);
    const formData = new FormData();
    formData.set("headerText", headerText);
    formData.set("footerNote", footerNote);
    formData.set("letterText", letterText);
    formData.set("showAddress", showAddress ? "true" : "false");
    formData.set("primaryColor", primaryColor);
    formData.set("font", font);
    formData.set("borderStyle", borderStyle);
    formData.set("headerLayout", headerLayout);
    formData.set("logoSize", String(logoSize));
    formData.set("headerBgColor", headerBgMode === "none" ? "" : headerBgColor);
    formData.set("headerBgGradientTo", headerBgMode === "gradient" ? headerBgGradientTo : "");
    formData.set("orgNameColor", orgNameColorMode === "custom" ? orgNameColor : "");
    formData.set("signature1Label", sig1Label);
    formData.set("signature2Label", sig2Label);
    if (sig1File) formData.set("signature1", sig1File);
    if (sig1Removed) formData.set("removeSignature1", "true");
    if (sig2File) formData.set("signature2", sig2File);
    if (sig2Removed) formData.set("removeSignature2", "true");

    startTransition(async () => {
      const result = await saveHallTicketCustomization(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSig1Url(result.signature1Url);
      setSig1File(null);
      setSig1Removed(false);
      setSig2Url(result.signature2Url);
      setSig2File(null);
      setSig2Removed(false);
      setSaved(true);
      router.refresh();
    });
  }

  const customization = {
    headerText,
    footerNote,
    letterText,
    showAddress,
    address: initial.orgAddress,
    primaryColor,
    font,
    borderStyle,
    headerLayout,
    logoSize,
    headerBgColor: headerBgMode === "none" ? null : headerBgColor,
    headerBgGradientTo: headerBgMode === "gradient" ? headerBgGradientTo : null,
    orgNameColor: orgNameColorMode === "custom" ? orgNameColor : null,
    signatures: [
      { url: sig1Url, label: sig1Label },
      { url: sig2Url, label: sig2Label },
    ],
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-charcoal">Hall ticket customization</h2>
        <p className="mt-1 text-sm text-slate">
          Header text, address, an instructions letter, colors, fonts, and up to two signatures for printed hall
          tickets. The preview updates as you type — nothing is saved until you click Save.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-charcoal">Quick-start templates</span>
            <div className="flex flex-wrap gap-2">
              {HALL_TICKET_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-charcoal transition-colors hover:bg-surface"
                >
                  <span className="size-3 shrink-0 rounded-full border border-border" style={{ backgroundColor: t.primaryColor }} />
                  {t.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate">
              A template just fills in color, font, border, and layout below — pick one as a starting point, then
              tweak anything, or skip this and build it entirely by hand.
            </span>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <span className="text-sm font-semibold text-charcoal">Your saved templates</span>
            {templates.length === 0 ? (
              <p className="text-xs text-slate">
                No saved templates yet — build a design below, then save it here to reuse later.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {templates.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm text-charcoal">
                      {t.name}
                      {t.isDefault && (
                        <span className="rounded-full bg-verified-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-verified">
                          Default
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-3 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => loadSavedTemplate(t)}
                        className="text-accent hover:text-accent-hover"
                      >
                        Load into editor
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(t.id)}
                        disabled={templatePending || t.isDefault}
                        className="text-accent hover:text-accent-hover disabled:opacity-50"
                      >
                        {t.isDefault ? "Is default" : "Set as default"}
                      </button>
                      {deletingTemplateId === t.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(t.id)}
                            disabled={templatePending}
                            className="text-alert"
                          >
                            Confirm delete
                          </button>
                          <button type="button" onClick={() => setDeletingTemplateId(null)} className="text-slate">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingTemplateId(t.id)}
                          className="text-alert hover:text-alert/80"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                value={templateName}
                onChange={(e) => {
                  setTemplateName(e.target.value);
                  setTemplateSaved(false);
                }}
                placeholder="Template name, e.g. Annual Exam Theme"
                className="min-w-0 flex-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
              />
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={templatePending}
                className="whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-surface disabled:opacity-50"
              >
                {templatePending ? "Working…" : "Save current design as template"}
              </button>
            </div>
            {templateSaved && !templatePending && (
              <span className="text-xs font-semibold text-verified">Template saved.</span>
            )}
            {templateError && (
              <p className="flex items-start gap-1.5 rounded-lg bg-alert-tint px-3 py-2 text-xs text-alert">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                {templateError}
              </p>
            )}
            <span className="text-xs text-slate">
              Saving captures your current text and styling, not signature images/labels — those always follow
              your uploaded files. &ldquo;Set as default&rdquo; makes a saved template the live design immediately,
              without needing Save changes below.
            </span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-charcoal">Header text</span>
            <input
              value={headerText}
              onChange={(e) => {
                setHeaderText(e.target.value);
                touch();
              }}
              placeholder="Hall Ticket"
              className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showAddress}
              onChange={(e) => {
                setShowAddress(e.target.checked);
                touch();
              }}
              className="size-4"
            />
            <span className="text-sm font-semibold text-charcoal">
              Show organization address on the ticket
              {!initial.orgAddress && (
                <span className="ml-1 font-normal text-slate">(set an address in Organization details first)</span>
              )}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-charcoal">Letter / instructions</span>
            <textarea
              value={letterText}
              onChange={(e) => {
                setLetterText(e.target.value);
                touch();
              }}
              placeholder="e.g. Candidates must report 30 minutes before the exam and carry a valid photo ID."
              rows={2}
              className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
            />
            <span className="text-xs text-slate">Shown once near the top of the ticket, above the exam table. Keep it brief.</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-charcoal">Footer note</span>
            <textarea
              value={footerNote}
              onChange={(e) => {
                setFooterNote(e.target.value);
                touch();
              }}
              placeholder="Present this ticket with a valid photo ID at the exam hall entrance. Each code is scanned once for entry."
              rows={2}
              className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-charcoal">Primary color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value);
                    touch();
                  }}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded border border-border"
                />
                <input
                  value={primaryColor}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value);
                    touch();
                  }}
                  className="w-full rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-charcoal">Font</span>
              <select
                value={font}
                onChange={(e) => {
                  setFont(e.target.value);
                  touch();
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
              >
                {HALL_TICKET_FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-charcoal">Border style</span>
              <select
                value={borderStyle}
                onChange={(e) => {
                  setBorderStyle(e.target.value as HallTicketBorderStyle);
                  touch();
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
              >
                {HALL_TICKET_BORDER_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-charcoal">Header layout</span>
              <select
                value={headerLayout}
                onChange={(e) => {
                  setHeaderLayout(e.target.value as HallTicketHeaderLayout);
                  touch();
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
              >
                {HALL_TICKET_LAYOUT_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-charcoal">Logo size ({logoSize}px)</span>
            <input
              type="range"
              min={HALL_TICKET_LOGO_SIZE_MIN}
              max={HALL_TICKET_LOGO_SIZE_MAX}
              step={4}
              value={logoSize}
              onChange={(e) => {
                setLogoSize(Number(e.target.value));
                touch();
              }}
              className="w-full accent-accent"
            />
          </label>

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <span className="text-sm font-semibold text-charcoal">Header background</span>
            <div className="flex gap-2">
              {(["none", "solid", "gradient"] as HeaderBgMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setHeaderBgMode(mode);
                    touch();
                  }}
                  className={
                    headerBgMode === mode
                      ? "rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold capitalize text-white"
                      : "rounded-lg border border-border px-3 py-1.5 text-xs font-semibold capitalize text-charcoal hover:bg-surface"
                  }
                >
                  {mode}
                </button>
              ))}
            </div>

            {headerBgMode !== "none" && (
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2">
                  <span className="text-xs text-slate">{headerBgMode === "gradient" ? "From" : "Color"}</span>
                  <input
                    type="color"
                    value={headerBgColor}
                    onChange={(e) => {
                      setHeaderBgColor(e.target.value);
                      touch();
                    }}
                    className="h-8 w-10 cursor-pointer rounded border border-border"
                  />
                </label>
                {headerBgMode === "gradient" && (
                  <label className="flex items-center gap-2">
                    <span className="text-xs text-slate">To</span>
                    <input
                      type="color"
                      value={headerBgGradientTo}
                      onChange={(e) => {
                        setHeaderBgGradientTo(e.target.value);
                        touch();
                      }}
                      className="h-8 w-10 cursor-pointer rounded border border-border"
                    />
                  </label>
                )}
              </div>
            )}
            <span className="text-xs text-slate">Header text switches to white automatically for contrast.</span>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <span className="text-sm font-semibold text-charcoal">Organization name color</span>
            <div className="flex gap-2">
              {(["auto", "custom"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setOrgNameColorMode(mode);
                    touch();
                  }}
                  className={
                    orgNameColorMode === mode
                      ? "rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold capitalize text-white"
                      : "rounded-lg border border-border px-3 py-1.5 text-xs font-semibold capitalize text-charcoal hover:bg-surface"
                  }
                >
                  {mode}
                </button>
              ))}
            </div>
            {orgNameColorMode === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={orgNameColor}
                  onChange={(e) => {
                    setOrgNameColor(e.target.value);
                    touch();
                  }}
                  className="h-8 w-10 cursor-pointer rounded border border-border"
                />
                <input
                  value={orgNameColor}
                  onChange={(e) => {
                    setOrgNameColor(e.target.value);
                    touch();
                  }}
                  className="w-full rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
                />
              </div>
            )}
            <span className="text-xs text-slate">
              Auto uses the primary color (or white on a header background). Custom overrides that with any color
              you pick.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SignatureSlot
              slotLabel="Signature 1"
              label={sig1Label}
              onLabelChange={(v) => {
                setSig1Label(v);
                touch();
              }}
              url={sig1Url}
              disabled={pending}
              onSelect={(file) => {
                setSig1File(file);
                setSig1Removed(false);
                setSig1Url(URL.createObjectURL(file));
                touch();
              }}
              onRemove={() => {
                setSig1File(null);
                setSig1Removed(true);
                setSig1Url(null);
                touch();
              }}
            />
            <SignatureSlot
              slotLabel="Signature 2"
              label={sig2Label}
              onLabelChange={(v) => {
                setSig2Label(v);
                touch();
              }}
              url={sig2Url}
              disabled={pending}
              onSelect={(file) => {
                setSig2File(file);
                setSig2Removed(false);
                setSig2Url(URL.createObjectURL(file));
                touch();
              }}
              onRemove={() => {
                setSig2File(null);
                setSig2Removed(true);
                setSig2Url(null);
                touch();
              }}
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-alert-tint px-3 py-2 text-xs text-alert">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          {saved && !pending && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-verified">
              <CheckCircle2 className="size-3.5" strokeWidth={2} />
              Saved
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-charcoal">Live preview</h2>
        <p className="mt-1 text-xs text-slate">Sample data — the real ticket uses each student&apos;s actual exams.</p>
        <div className="mt-4 overflow-x-auto">
          <HallTicket
            orgName={initial.orgName}
            orgLogoUrl={initial.orgLogoUrl}
            title="Hall Ticket"
            studentFullName="Sample Student"
            studentRollNumber="2024001"
            photoUrl={null}
            exams={SAMPLE_EXAMS}
            customization={customization}
          />
        </div>
      </div>
    </div>
  );
}
