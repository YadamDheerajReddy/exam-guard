"use client";

import { useMemo, useState } from "react";

type Student = {
  id: string;
  rollNumber: string;
  fullName: string;
  email: string;
  department: string;
  isActive: boolean;
  photoUrl: string | null;
};

export function StudentsTable({ students }: { students: Student[] }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");

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
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    {s.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not worth next/image remotePatterns config for an admin thumbnail
                      <img
                        src={s.photoUrl}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-surface" />
                    )}
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
