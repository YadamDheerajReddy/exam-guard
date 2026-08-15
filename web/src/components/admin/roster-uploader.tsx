"use client";

import { useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { normalizeHeader, validateRosterRows, type RosterRow } from "@/lib/roster";
import { uploadRoster, type RosterUploadResult } from "@/app/admin/(protected)/(org)/roster/actions";

type Status = "invalid" | "valid" | "created" | "server-error";
type Row = RosterRow & { rowNumber: number; status: Status; error: string | null };

const REQUIRED_COLUMNS: (keyof RosterRow)[] = ["rollNumber", "fullName", "email", "department"];

export function RosterUploader() {
  const [rows, setRows] = useState<Row[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setParseError(null);
    setSubmitted(false);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const fields = result.meta.fields ?? [];
        const mapped = fields
          .map((f) => normalizeHeader(f))
          .filter((f): f is keyof RosterRow => f !== null);

        const missing = REQUIRED_COLUMNS.filter((c) => !mapped.includes(c));
        if (missing.length > 0) {
          setParseError(
            `Missing required column(s): ${missing.join(", ")}. Expected headers: roll_number, full_name, email, department (photo_url optional).`,
          );
          setRows([]);
          return;
        }

        const parsedRows: RosterRow[] = result.data.map((record) => {
          const row: RosterRow = {
            rollNumber: "",
            fullName: "",
            email: "",
            department: "",
            photoUrl: "",
          };
          for (const [header, value] of Object.entries(record)) {
            const key = normalizeHeader(header);
            if (key) row[key] = value ?? "";
          }
          return row;
        });

        const validated = validateRosterRows(parsedRows);
        setRows(
          validated.map((r) => ({
            ...r,
            status: r.error ? "invalid" : "valid",
          })),
        );
      },
      error: (err) => setParseError(err.message),
    });
  }

  const validRows = rows.filter((r) => r.status === "valid");
  const createdCount = rows.filter((r) => r.status === "created").length;
  const failedCount = rows.filter((r) => r.status === "invalid" || r.status === "server-error").length;

  function handleUpload() {
    setUploadError(null);
    startTransition(async () => {
      try {
        const results = await uploadRoster(
          validRows.map(({ rowNumber, rollNumber, fullName, email, department, photoUrl }) => ({
            rowNumber,
            rollNumber,
            fullName,
            email,
            department,
            photoUrl,
          })),
        );
        const byRow = new Map<number, RosterUploadResult>(results.map((r) => [r.rowNumber, r]));

        setRows((prev) =>
          prev.map((row) => {
            const result = byRow.get(row.rowNumber);
            if (!result) return row;
            return {
              ...row,
              status: result.ok ? "created" : "server-error",
              error: result.ok ? `Temp password: ${result.tempPassword}` : (result.error ?? "Failed"),
            };
          }),
        );
        setSubmitted(true);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed unexpectedly.");
      }
    });
  }

  function downloadErrorReport() {
    const failed = rows.filter((r) => r.status === "invalid" || r.status === "server-error");
    const csv = [
      "row,roll_number,full_name,email,department,error",
      ...failed.map((r) =>
        [r.rowNumber, r.rollNumber, r.fullName, r.email, r.department, r.error ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roster-upload-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCredentials() {
    const created = rows.filter((r) => r.status === "created");
    const csv = [
      "roll_number,full_name,temp_password",
      ...created.map((r) =>
        [r.rollNumber, r.fullName, r.error?.replace("Temp password: ", "") ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roster-upload-credentials.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-border bg-white p-5">
        <h2 className="text-sm font-semibold text-charcoal">Upload roster</h2>
        <p className="mt-1 text-sm text-slate">
          CSV with columns: roll_number, full_name, email, department, photo_url (optional).
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="mt-3 text-sm text-charcoal"
        />
        {parseError && (
          <p className="mt-3 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
            {parseError}
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <div className="rounded-lg border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="text-sm text-charcoal">
              {rows.length} row{rows.length === 1 ? "" : "s"} parsed ·{" "}
              {submitted
                ? `${createdCount} created, ${failedCount} failed`
                : `${validRows.length} ready to upload, ${rows.length - validRows.length} need fixing`}
            </p>
            <div className="flex gap-3">
              {failedCount > 0 && (
                <button
                  onClick={downloadErrorReport}
                  className="text-sm font-semibold text-accent hover:text-accent-hover"
                >
                  Download error report
                </button>
              )}
              {createdCount > 0 && (
                <button
                  onClick={downloadCredentials}
                  className="text-sm font-semibold text-accent hover:text-accent-hover"
                >
                  Download credentials
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-wide text-slate">
                  <th className="px-4 py-2">Row</th>
                  <th className="px-4 py-2">Roll number</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Department</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={
                      row.status === "invalid" || row.status === "server-error"
                        ? "border-b border-border bg-alert-tint last:border-0"
                        : row.status === "created"
                          ? "border-b border-border bg-verified-tint last:border-0"
                          : "border-b border-border last:border-0"
                    }
                  >
                    <td className="px-4 py-2 text-charcoal">{row.rowNumber}</td>
                    <td className="px-4 py-2 font-mono text-charcoal">{row.rollNumber}</td>
                    <td className="px-4 py-2 text-charcoal">{row.fullName}</td>
                    <td className="px-4 py-2 text-charcoal">{row.email}</td>
                    <td className="px-4 py-2 text-charcoal">{row.department}</td>
                    <td className="px-4 py-2">
                      {row.status === "invalid" && (
                        <span className="text-alert">{row.error}</span>
                      )}
                      {row.status === "server-error" && (
                        <span className="text-alert">{row.error}</span>
                      )}
                      {row.status === "created" && (
                        <span className="font-mono text-verified">{row.error}</span>
                      )}
                      {row.status === "valid" && <span className="text-slate">Ready</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!submitted && (
            <div className="border-t border-border px-5 py-4">
              {uploadError && (
                <p className="mb-3 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
                  {uploadError}
                </p>
              )}
              <button
                onClick={handleUpload}
                disabled={pending || validRows.length === 0}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {pending ? "Uploading…" : `Upload ${validRows.length} student${validRows.length === 1 ? "" : "s"}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
