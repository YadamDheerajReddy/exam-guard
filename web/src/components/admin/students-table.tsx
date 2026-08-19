"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetStudentPassword, updateStudent, deleteStudent } from "@/app/admin/(protected)/(org)/students/actions";
import { uploadStudentPhoto } from "@/app/admin/(protected)/(org)/roster/actions";
import { AlertCircle, CheckCircle2, ImageOff, KeyRound, Pencil, Search, Trash2, XCircle } from "lucide-react";

type Student = {
  id: string;
  rollNumber: string;
  fullName: string;
  email: string;
  department: string;
  isActive: boolean;
  photoUrl: string | null;
  // Whether a photo path is stored at all, kept separate from photoUrl
  // (the resolved signed URL). Counting on the stored path keeps this
  // number identical to the dashboard's warning banner, which can't afford
  // to sign a URL per student just to produce a count.
  hasPhoto: boolean;
};

type PhotoState = { status: "uploading" } | { status: "error"; error: string };
type ResetState =
  | { status: "pending" }
  | { status: "done"; tempPassword: string }
  | { status: "error"; error: string };
type DeleteState =
  | { status: "confirming" }
  | { status: "pending" }
  | { status: "done"; action: "anonymized" | "deleted" }
  | { status: "error"; error: string };

export function StudentsTable({
  students,
  initialMissingPhotoOnly = false,
  isSchool = false,
}: {
  students: Student[];
  initialMissingPhotoOnly?: boolean;
  isSchool?: boolean;
}) {
  const router = useRouter();
  const fieldLabel = isSchool ? "Class" : "Department";
  const fieldLabelPlural = isSchool ? "classes" : "departments";
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [missingPhotoOnly, setMissingPhotoOnly] = useState(initialMissingPhotoOnly);
  const [photoOverrides, setPhotoOverrides] = useState<Map<string, string>>(new Map());
  const [photoStates, setPhotoStates] = useState<Map<string, PhotoState>>(new Map());
  const [resetStates, setResetStates] = useState<Map<string, ResetState>>(new Map());
  const [deleteStates, setDeleteStates] = useState<Map<string, DeleteState>>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const departments = useMemo(
    () => Array.from(new Set(students.map((s) => s.department))).sort(),
    [students],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (department !== "all" && s.department !== department) return false;
      if (missingPhotoOnly && s.hasPhoto) return false;
      if (!q) return true;
      return (
        s.rollNumber.toLowerCase().includes(q) || s.fullName.toLowerCase().includes(q)
      );
    });
  }, [students, query, department, missingPhotoOnly]);

  const missingPhotoCount = useMemo(() => students.filter((s) => !s.hasPhoto).length, [students]);

  function handlePhotoSelect(studentId: string, file: File) {
    setPhotoStates((prev) => new Map(prev).set(studentId, { status: "uploading" }));
    const formData = new FormData();
    formData.set("photo", file);

    startTransition(async () => {
      const result = await uploadStudentPhoto(studentId, formData);
      if (result.ok) {
        setPhotoOverrides((prev) => new Map(prev).set(studentId, result.signedUrl));
        setPhotoStates((prev) => {
          const next = new Map(prev);
          next.delete(studentId);
          return next;
        });
      } else {
        setPhotoStates((prev) => new Map(prev).set(studentId, { status: "error", error: result.error }));
      }
    });
  }

  function handleResetPassword(studentId: string) {
    setResetStates((prev) => new Map(prev).set(studentId, { status: "pending" }));
    startTransition(async () => {
      const result = await resetStudentPassword(studentId);
      setResetStates((prev) =>
        new Map(prev).set(
          studentId,
          result.ok
            ? { status: "done", tempPassword: result.tempPassword }
            : { status: "error", error: result.error },
        ),
      );
      router.refresh();
    });
  }

  function handleSaveEdit(studentId: string, formData: FormData) {
    setEditError(null);
    startTransition(async () => {
      const result = await updateStudent(studentId, undefined, formData);
      if (result?.error) {
        setEditError(result.error);
      } else {
        setEditingId(null);
        router.refresh();
      }
    });
  }

  function handleDelete(studentId: string) {
    setDeleteStates((prev) => new Map(prev).set(studentId, { status: "pending" }));
    startTransition(async () => {
      const result = await deleteStudent(studentId);
      setDeleteStates((prev) =>
        new Map(prev).set(
          studentId,
          result.error ? { status: "error", error: result.error } : { status: "done", action: result.action! },
        ),
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by roll number or name"
            className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
          />
        </div>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm text-ink"
        >
          <option value="all">All {fieldLabelPlural}</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setMissingPhotoOnly((v) => !v)}
          disabled={missingPhotoCount === 0}
          className={`flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
            missingPhotoOnly
              ? "border-pending bg-pending-tint text-pending"
              : "border-border text-charcoal hover:bg-surface"
          }`}
        >
          <ImageOff className="size-4" strokeWidth={2} />
          No photo ({missingPhotoCount})
        </button>
      </div>

      <div className="overflow-x-auto overflow-hidden rounded-lg border border-border bg-white">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate">
            {students.length === 0 ? "No students yet." : "No students match."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-wide text-slate">
                <th className="px-4 py-2" />
                <th className="px-4 py-2">Roll number</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">{fieldLabel}</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Credentials</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const photoUrl = photoOverrides.get(s.id) ?? s.photoUrl;
                const photoState = photoStates.get(s.id);
                const resetState = resetStates.get(s.id);
                const deleteState = deleteStates.get(s.id);
                const inputId = `student-photo-${s.id}`;
                const isEditing = editingId === s.id;

                if (deleteState?.status === "done") {
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td colSpan={8} className="px-4 py-3 text-sm text-charcoal">
                        <span className="font-mono">{s.rollNumber}</span>{" "}
                        {deleteState.action === "deleted"
                          ? "was deleted."
                          : "was anonymized — verification history was retained."}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={s.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface">
                    <td className="px-4 py-2">
                      <div className="flex flex-col items-center gap-1">
                        {photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not worth next/image remotePatterns config for an admin thumbnail
                          <img src={photoUrl} alt="" className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <div
                            title="No photo on file"
                            className="flex h-8 w-8 items-center justify-center rounded bg-pending-tint"
                          >
                            <ImageOff className="size-4 text-pending" strokeWidth={2} />
                          </div>
                        )}
                        <label
                          htmlFor={inputId}
                          title="Used only for identity verification at the exam hall entrance."
                          className="cursor-pointer text-xs font-semibold text-accent hover:text-accent-hover"
                        >
                          {photoState?.status === "uploading" ? "…" : photoUrl ? "Change" : "Upload"}
                        </label>
                        <input
                          id={inputId}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={photoState?.status === "uploading"}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoSelect(s.id, file);
                            e.target.value = "";
                          }}
                        />
                        {photoState?.status === "error" && (
                          <span className="text-xs text-alert">{photoState.error}</span>
                        )}
                      </div>
                    </td>

                    {isEditing ? (
                      <td colSpan={4} className="px-4 py-2">
                        <form
                          action={(formData) => handleSaveEdit(s.id, formData)}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            name="rollNumber"
                            defaultValue={s.rollNumber}
                            required
                            className="w-28 rounded-lg border border-border px-2 py-1 font-mono text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
                          />
                          <input
                            name="fullName"
                            defaultValue={s.fullName}
                            required
                            className="min-w-0 flex-1 rounded-lg border border-border px-2 py-1 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
                          />
                          <input
                            name="department"
                            defaultValue={s.department}
                            required
                            placeholder={fieldLabel}
                            className="w-32 rounded-lg border border-border px-2 py-1 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
                          />
                          <button
                            type="submit"
                            disabled={pending}
                            className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditError(null);
                            }}
                            className="text-xs font-semibold text-slate"
                          >
                            Cancel
                          </button>
                          {editError && (
                            <p className="flex w-full items-center gap-1.5 text-xs text-alert">
                              <AlertCircle className="size-3.5 shrink-0" strokeWidth={2} />
                              {editError}
                            </p>
                          )}
                        </form>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-2 font-mono text-charcoal">{s.rollNumber}</td>
                        <td className="max-w-[16rem] truncate px-4 py-2 text-charcoal">{s.fullName}</td>
                        <td className="max-w-[16rem] truncate px-4 py-2 text-charcoal">{s.email}</td>
                        <td className="px-4 py-2 text-charcoal">{s.department}</td>
                      </>
                    )}

                    <td className="px-4 py-2">
                      <span
                        className={`flex items-center gap-1.5 ${s.isActive ? "text-verified" : "text-inactive"}`}
                      >
                        {s.isActive ? (
                          <CheckCircle2 className="size-4" strokeWidth={2} />
                        ) : (
                          <XCircle className="size-4" strokeWidth={2} />
                        )}
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {resetState?.status === "done" ? (
                        <span className="font-mono text-verified">
                          New password: {resetState.tempPassword}
                        </span>
                      ) : resetState?.status === "error" ? (
                        <span className="text-alert">{resetState.error}</span>
                      ) : (
                        <button
                          onClick={() => handleResetPassword(s.id)}
                          disabled={resetState?.status === "pending"}
                          className="flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent-hover disabled:opacity-60"
                        >
                          <KeyRound className="size-3.5" strokeWidth={2} />
                          {resetState?.status === "pending" ? "Resetting…" : "Reset password"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {deleteState?.status === "confirming" ? (
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-xs text-charcoal">
                            {s.isActive ? "Not returning? " : ""}
                            If scanned before, this anonymizes instead of deleting.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="text-xs font-semibold text-alert"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() =>
                                setDeleteStates((prev) => {
                                  const next = new Map(prev);
                                  next.delete(s.id);
                                  return next;
                                })
                              }
                              className="text-xs font-semibold text-slate"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : deleteState?.status === "error" ? (
                        <span className="text-xs text-alert">{deleteState.error}</span>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => {
                              setEditingId(isEditing ? null : s.id);
                              setEditError(null);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-accent transition-colors hover:text-accent-hover"
                          >
                            <Pencil className="size-3.5" strokeWidth={2} />
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteStates((prev) => new Map(prev).set(s.id, { status: "confirming" }))}
                            disabled={deleteState?.status === "pending"}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-alert transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="size-3.5" strokeWidth={2} />
                            {deleteState?.status === "pending" ? "…" : "Delete"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
