"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetStudentPassword } from "@/app/admin/(protected)/(org)/students/actions";
import { uploadStudentPhoto } from "@/app/admin/(protected)/(org)/roster/actions";

type Student = {
  id: string;
  rollNumber: string;
  fullName: string;
  email: string;
  department: string;
  isActive: boolean;
  photoUrl: string | null;
};

type PhotoState = { status: "uploading" } | { status: "error"; error: string };
type ResetState =
  | { status: "pending" }
  | { status: "done"; tempPassword: string }
  | { status: "error"; error: string };

export function StudentsTable({ students }: { students: Student[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [photoOverrides, setPhotoOverrides] = useState<Map<string, string>>(new Map());
  const [photoStates, setPhotoStates] = useState<Map<string, PhotoState>>(new Map());
  const [resetStates, setResetStates] = useState<Map<string, ResetState>>(new Map());
  const [, startTransition] = useTransition();

  const departments = useMemo(
    () => Array.from(new Set(students.map((s) => s.department))).sort(),
    [students],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (department !== "all" && s.department !== department) return false;
      if (!q) return true;
      return (
        s.rollNumber.toLowerCase().includes(q) || s.fullName.toLowerCase().includes(q)
      );
    });
  }, [students, query, department]);

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by roll number or name"
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm text-ink"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
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
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Credentials</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const photoUrl = photoOverrides.get(s.id) ?? s.photoUrl;
                const photoState = photoStates.get(s.id);
                const resetState = resetStates.get(s.id);
                const inputId = `student-photo-${s.id}`;

                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <div className="flex flex-col items-center gap-1">
                        {photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not worth next/image remotePatterns config for an admin thumbnail
                          <img src={photoUrl} alt="" className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-surface" />
                        )}
                        <label
                          htmlFor={inputId}
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
                    <td className="px-4 py-2 font-mono text-charcoal">{s.rollNumber}</td>
                    <td className="px-4 py-2 text-charcoal">{s.fullName}</td>
                    <td className="px-4 py-2 text-charcoal">{s.email}</td>
                    <td className="px-4 py-2 text-charcoal">{s.department}</td>
                    <td className="px-4 py-2">
                      <span className={s.isActive ? "text-verified" : "text-inactive"}>
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
                          className="text-sm font-semibold text-accent hover:text-accent-hover disabled:opacity-60"
                        >
                          {resetState?.status === "pending" ? "Resetting…" : "Reset password"}
                        </button>
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
