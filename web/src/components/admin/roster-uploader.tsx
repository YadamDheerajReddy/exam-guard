"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { normalizeHeader, validateRosterRows, type RosterRow } from "@/lib/roster";
import { uploadRoster, uploadStudentPhoto } from "@/app/admin/(protected)/(org)/roster/actions";

type Submission =
  | { status: "created"; tempPassword: string; studentId: string }
  | { status: "server-error"; error: string };

type PhotoState =
  | { status: "uploading" }
  | { status: "uploaded"; signedUrl: string }
  | { status: "error"; error: string };

type Entry = { id: number; row: RosterRow };

const REQUIRED_COLUMNS: (keyof RosterRow)[] = ["rollNumber", "fullName", "email", "department"];

const emptyRow = (): RosterRow => ({
  rollNumber: "",
  fullName: "",
  email: "",
  department: "",
  photoUrl: "",
});

export function RosterUploader() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [submissions, setSubmissions] = useState<Map<number, Submission>>(new Map());
  const [photos, setPhotos] = useState<Map<number, PhotoState>>(new Map());
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [manualRow, setManualRow] = useState<RosterRow>(emptyRow());
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  const validated = useMemo(
    () => validateRosterRows(entries.map((e) => e.row)),
    [entries],
  );

  const rows = entries.map((entry, i) => ({
    entry,
    error: validated[i]?.error ?? null,
    submission: submissions.get(entry.id) ?? null,
  }));

  const uploadable = rows.filter((r) => !r.error && !r.submission);
  const createdCount = rows.filter((r) => r.submission?.status === "created").length;
  const failedCount = rows.filter((r) => r.error || r.submission?.status === "server-error").length;

  function addEntries(newRows: RosterRow[]) {
    setEntries((prev) => [
      ...prev,
      ...newRows.map((row) => ({ id: nextId.current++, row })),
    ]);
  }

  function handleFile(file: File) {
    setParseError(null);

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
          return;
        }

        const parsedRows: RosterRow[] = result.data.map((record) => {
          const row = emptyRow();
          for (const [header, value] of Object.entries(record)) {
            const key = normalizeHeader(header);
            if (key) row[key] = value ?? "";
          }
          return row;
        });

        addEntries(parsedRows);
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      error: (err) => setParseError(err.message),
    });
  }

  function handleAddManualRow() {
    if (
      !manualRow.rollNumber.trim() ||
      !manualRow.fullName.trim() ||
      !manualRow.email.trim() ||
      !manualRow.department.trim()
    ) {
      return;
    }
    addEntries([manualRow]);
    setManualRow(emptyRow());
  }

  function removeEntry(id: number) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setSubmissions((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function clearAll() {
    setEntries([]);
    setSubmissions(new Map());
    setUploadError(null);
  }

  function handleUpload() {
    setUploadError(null);
    const batch = uploadable.map((r) => ({ rowNumber: r.entry.id, ...r.entry.row }));

    startTransition(async () => {
      try {
        const results = await uploadRoster(batch);
        setSubmissions((prev) => {
          const next = new Map(prev);
          for (const result of results) {
            next.set(
              result.rowNumber,
              result.ok
                ? {
                    status: "created",
                    tempPassword: result.tempPassword ?? "",
                    studentId: result.studentId ?? "",
                  }
                : { status: "server-error", error: result.error ?? "Failed" },
            );
          }
          return next;
        });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed unexpectedly.");
      }
    });
  }

  function handlePhotoSelect(entryId: number, studentId: string, file: File) {
    setPhotos((prev) => new Map(prev).set(entryId, { status: "uploading" }));

    const formData = new FormData();
    formData.set("photo", file);

    startTransition(async () => {
      try {
        const result = await uploadStudentPhoto(studentId, formData);
        setPhotos((prev) =>
          new Map(prev).set(
            entryId,
            result.ok
              ? { status: "uploaded", signedUrl: result.signedUrl }
              : { status: "error", error: result.error },
          ),
        );
      } catch (err) {
        setPhotos((prev) =>
          new Map(prev).set(entryId, {
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed unexpectedly.",
          }),
        );
      }
    });
  }

  function downloadErrorReport() {
    const failed = rows.filter((r) => r.error || r.submission?.status === "server-error");
    const csv = [
      "roll_number,full_name,email,department,error",
      ...failed.map((r) =>
        [
          r.entry.row.rollNumber,
          r.entry.row.fullName,
          r.entry.row.email,
          r.entry.row.department,
          r.error ?? (r.submission?.status === "server-error" ? r.submission.error : ""),
        ]
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
    const created = rows.filter((r) => r.submission?.status === "created");
    const csv = [
      "roll_number,full_name,temp_password",
      ...created.map((r) =>
        [
          r.entry.row.rollNumber,
          r.entry.row.fullName,
          r.submission?.status === "created" ? r.submission.tempPassword : "",
        ]
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
      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-sm font-semibold text-charcoal">Upload a CSV</h2>
          <p className="mt-1 text-sm text-slate">
            Columns: roll_number, full_name, email, department, photo_url (optional).
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

        <div className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-sm font-semibold text-charcoal">Or add a student</h2>
          <div className="mt-3 flex flex-col gap-2">
            <input
              value={manualRow.rollNumber}
              onChange={(e) => setManualRow({ ...manualRow, rollNumber: e.target.value })}
              placeholder="Roll number"
              className="rounded-lg border border-border px-3 py-1.5 font-mono text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
            />
            <input
              value={manualRow.fullName}
              onChange={(e) => setManualRow({ ...manualRow, fullName: e.target.value })}
              placeholder="Full name"
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
            />
            <input
              value={manualRow.email}
              onChange={(e) => setManualRow({ ...manualRow, email: e.target.value })}
              placeholder="Email"
              type="email"
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
            />
            <input
              value={manualRow.department}
              onChange={(e) => setManualRow({ ...manualRow, department: e.target.value })}
              placeholder="Department"
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
            />
            <button
              onClick={handleAddManualRow}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-charcoal hover:bg-surface"
            >
              Add to roster
            </button>
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="rounded-lg border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="text-sm text-charcoal">
              {rows.length} student{rows.length === 1 ? "" : "s"} listed ·{" "}
              {createdCount} created, {failedCount} need fixing, {uploadable.length} ready
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
              <button
                onClick={clearAll}
                className="text-sm font-semibold text-slate hover:text-charcoal"
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-wide text-slate">
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Roll number</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Department</th>
                  <th className="px-4 py-2">Photo</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.entry.id}
                    className={
                      r.error || r.submission?.status === "server-error"
                        ? "border-b border-border bg-alert-tint last:border-0"
                        : r.submission?.status === "created"
                          ? "border-b border-border bg-verified-tint last:border-0"
                          : "border-b border-border last:border-0"
                    }
                  >
                    <td className="px-4 py-2 text-charcoal">{i + 1}</td>
                    <td className="px-4 py-2 font-mono text-charcoal">{r.entry.row.rollNumber}</td>
                    <td className="px-4 py-2 text-charcoal">{r.entry.row.fullName}</td>
                    <td className="px-4 py-2 text-charcoal">{r.entry.row.email}</td>
                    <td className="px-4 py-2 text-charcoal">{r.entry.row.department}</td>
                    <td className="px-4 py-2">
                      {r.submission?.status === "created" ? (
                        <PhotoCell
                          entryId={r.entry.id}
                          studentId={r.submission.studentId}
                          photo={photos.get(r.entry.id) ?? null}
                          onSelect={handlePhotoSelect}
                        />
                      ) : (
                        <span className="text-slate">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {r.error && <span className="text-alert">{r.error}</span>}
                      {!r.error && r.submission?.status === "server-error" && (
                        <span className="text-alert">{r.submission.error}</span>
                      )}
                      {!r.error && r.submission?.status === "created" && (
                        <span className="font-mono text-verified">
                          Temp password: {r.submission.tempPassword}
                        </span>
                      )}
                      {!r.error && !r.submission && <span className="text-slate">Ready</span>}
                    </td>
                    <td className="px-4 py-2">
                      {r.submission?.status !== "created" && (
                        <button
                          onClick={() => removeEntry(r.entry.id)}
                          className="text-sm font-semibold text-alert"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-border px-5 py-4">
            {uploadError && (
              <p className="mb-3 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
                {uploadError}
              </p>
            )}
            <button
              onClick={handleUpload}
              disabled={pending || uploadable.length === 0}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {pending
                ? "Uploading…"
                : `Upload ${uploadable.length} student${uploadable.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoCell({
  entryId,
  studentId,
  photo,
  onSelect,
}: {
  entryId: number;
  studentId: string;
  photo: PhotoState | null;
  onSelect: (entryId: number, studentId: string, file: File) => void;
}) {
  const inputId = `photo-${entryId}`;

  return (
    <div className="flex items-center gap-2">
      {photo?.status === "uploaded" && (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not worth next/image remotePatterns config for an admin thumbnail
        <img
          src={photo.signedUrl}
          alt=""
          className="h-8 w-8 rounded object-cover"
        />
      )}
      <label
        htmlFor={inputId}
        className="cursor-pointer text-sm font-semibold text-accent hover:text-accent-hover"
      >
        {photo?.status === "uploading"
          ? "Uploading…"
          : photo?.status === "uploaded"
            ? "Change"
            : "Upload photo"}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={photo?.status === "uploading"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(entryId, studentId, file);
          e.target.value = "";
        }}
      />
      {photo?.status === "error" && (
        <span className="text-xs text-alert">{photo.error}</span>
      )}
    </div>
  );
}
