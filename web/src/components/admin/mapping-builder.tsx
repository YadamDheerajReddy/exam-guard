"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createMappings,
  createGroupMappings,
  type MappingAssignment,
  type GroupMappingRowResult,
} from "@/app/admin/(protected)/(org)/exams/[examId]/mapping/actions";
import { Printer } from "lucide-react";

type Hall = {
  id: string;
  buildingName: string;
  roomNumber: string;
  capacity: number;
  usedSeats: number;
};
type Student = {
  id: string;
  rollNumber: string;
  fullName: string;
  department: string;
};
type ExistingMapping = {
  id: string;
  rollNumber: string;
  fullName: string;
  hallLabel: string;
  seatNumber: string;
};
type RosterBatch = {
  id: string;
  label: string;
  studentIds: string[];
};
type ExamGroup = {
  id: string;
  name: string;
  exams: { id: string; courseCode: string }[];
};
type Assignment = {
  studentId: string;
  rollNumber: string;
  fullName: string;
  hallId: string;
  seatNumber: string;
  status: "pending" | "created" | "partial" | "error";
  error?: string;
  groupResults?: GroupMappingRowResult[];
};

function hallLabel(hall: Hall) {
  return `${hall.buildingName} · ${hall.roomNumber} (${hall.usedSeats}/${hall.capacity})`;
}

// Seats get filled in the order this returns, so consecutive positions
// become consecutive (physically adjacent) seat numbers within a hall.
// Greedily picks from whichever department has the most students left
// that isn't the department just picked — same approach as the classic
// "reorganize string so no two adjacent characters match" problem. If one
// department is more than half the group, some adjacency is unavoidable;
// this still minimizes it as much as possible rather than giving up.
function interleaveByDepartment(students: Student[]): Student[] {
  const groups = new Map<string, Student[]>();
  for (const s of students) {
    const list = groups.get(s.department) ?? [];
    list.push(s);
    groups.set(s.department, list);
  }

  const queues = Array.from(groups.entries()).map(([department, list]) => ({
    department,
    list,
    idx: 0,
  }));

  const result: Student[] = [];
  let lastDepartment: string | null = null;

  while (result.length < students.length) {
    queues.sort((a, b) => (b.list.length - b.idx) - (a.list.length - a.idx));

    const next =
      queues.find((q) => q.idx < q.list.length && q.department !== lastDepartment) ??
      queues.find((q) => q.idx < q.list.length);
    if (!next) break;

    result.push(next.list[next.idx]);
    next.idx++;
    lastDepartment = next.department;
  }

  return result;
}

export function MappingBuilder({
  examId,
  isSchool,
  examGroup,
  halls,
  studentsForExamMode,
  studentsForGroupMode,
  rosterBatches,
  existingMappings,
}: {
  examId: string;
  isSchool: boolean;
  examGroup: ExamGroup | null;
  halls: Hall[];
  studentsForExamMode: Student[];
  studentsForGroupMode: Student[];
  rosterBatches: RosterBatch[];
  existingMappings: ExistingMapping[];
}) {
  const router = useRouter();
  const [scope, setScope] = useState<"exam" | "group">("exam");
  const [department, setDepartment] = useState("all");
  const [batchId, setBatchId] = useState("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectedHallIds, setSelectedHallIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"select" | "review">("select");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const students = examGroup && scope === "group" ? studentsForGroupMode : studentsForExamMode;

  // The two pools differ (group mode includes students already mapped to
  // this exam but missing another one in the group) — a selection made
  // under one scope can point at a student not offered under the other, so
  // switching scopes drops the in-progress selection rather than carry
  // over ids that might not resolve.
  function changeScope(next: "exam" | "group") {
    setScope(next);
    setSelectedStudentIds(new Set());
  }

  const departments = useMemo(
    () => Array.from(new Set(students.map((s) => s.department))).sort(),
    [students],
  );

  const filteredStudents = useMemo(() => {
    let list = students;
    if (department !== "all") list = list.filter((s) => s.department === department);
    if (batchId !== "all") {
      const batch = rosterBatches.find((b) => b.id === batchId);
      const ids = new Set(batch?.studentIds ?? []);
      list = list.filter((s) => ids.has(s.id));
    }
    return list;
  }, [students, department, batchId, rosterBatches]);

  function toggleStudent(id: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleHall(id: string) {
    setSelectedHallIds((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id],
    );
  }

  function selectedStudentList(): Student[] {
    return students.filter((s) => selectedStudentIds.has(s.id));
  }

  function buildManual() {
    const defaultHall = selectedHallIds[0] ?? "";
    setAssignments(
      selectedStudentList().map((s) => ({
        studentId: s.id,
        rollNumber: s.rollNumber,
        fullName: s.fullName,
        hallId: defaultHall,
        seatNumber: "",
        status: "pending",
      })),
    );
    setReviewError(null);
    setMode("review");
  }

  function buildAutoAllocated() {
    const pickedHalls = halls.filter((h) => selectedHallIds.includes(h.id));
    const remaining = new Map(pickedHalls.map((h) => [h.id, h.capacity - h.usedSeats]));
    const nextSeat = new Map(pickedHalls.map((h) => [h.id, h.usedSeats + 1]));

    const result: Assignment[] = [];
    let hallIndex = 0;

    for (const student of interleaveByDepartment(selectedStudentList())) {
      while (
        hallIndex < pickedHalls.length &&
        (remaining.get(pickedHalls[hallIndex].id) ?? 0) <= 0
      ) {
        hallIndex++;
      }
      if (hallIndex >= pickedHalls.length) {
        result.push({
          studentId: student.id,
          rollNumber: student.rollNumber,
          fullName: student.fullName,
          hallId: "",
          seatNumber: "",
          status: "pending",
        });
        continue;
      }

      const hall = pickedHalls[hallIndex];
      const seat = nextSeat.get(hall.id)!;
      nextSeat.set(hall.id, seat + 1);
      remaining.set(hall.id, (remaining.get(hall.id) ?? 0) - 1);

      result.push({
        studentId: student.id,
        rollNumber: student.rollNumber,
        fullName: student.fullName,
        hallId: hall.id,
        seatNumber: String(seat),
        status: "pending",
      });
    }

    setAssignments(result);
    setReviewError(
      result.some((r) => !r.hallId)
        ? "Selected halls don't have enough capacity for everyone — fill in the remaining rows manually below."
        : null,
    );
    setMode("review");
  }

  function updateAssignment(studentId: string, patch: Partial<Assignment>) {
    setAssignments((prev) =>
      prev.map((a) => (a.studentId === studentId ? { ...a, ...patch } : a)),
    );
  }

  function removeAssignment(studentId: string) {
    setAssignments((prev) => prev.filter((a) => a.studentId !== studentId));
  }

  function handleConfirm() {
    const pendingRows = assignments.filter((a) => a.status !== "created");
    const missing = pendingRows.filter((a) => !a.hallId || !a.seatNumber.trim());
    if (missing.length > 0) {
      setReviewError(`${missing.length} row(s) are missing a hall or seat number.`);
      return;
    }
    setReviewError(null);

    const payload: MappingAssignment[] = pendingRows.map((a) => ({
      studentId: a.studentId,
      hallId: a.hallId,
      seatNumber: a.seatNumber.trim(),
    }));

    startTransition(async () => {
      try {
        if (examGroup && scope === "group") {
          const results = await createGroupMappings(examGroup.id, payload);
          const byId = new Map(results.map((r) => [r.studentId, r]));

          setAssignments((prev) =>
            prev.map((a) => {
              const result = byId.get(a.studentId);
              if (!result) return a;
              const okCount = result.results.filter((r) => r.ok).length;
              const status = okCount === result.results.length ? "created" : okCount === 0 ? "error" : "partial";
              return {
                ...a,
                status,
                groupResults: result.results,
                error: status === "error" ? result.results[0]?.error : undefined,
              };
            }),
          );

          if (results.every((r) => r.results.every((row) => row.ok))) {
            router.refresh();
          }
        } else {
          const results = await createMappings(examId, payload);
          const byId = new Map(results.map((r) => [r.studentId, r]));

          setAssignments((prev) =>
            prev.map((a) => {
              const result = byId.get(a.studentId);
              if (!result) return a;
              return result.ok
                ? { ...a, status: "created" }
                : { ...a, status: "error", error: result.error };
            }),
          );

          if (results.every((r) => r.ok)) {
            router.refresh();
          }
        }
      } catch (err) {
        setReviewError(err instanceof Error ? err.message : "Something went wrong unexpectedly.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {existingMappings.length > 0 && (
        <details className="rounded-lg border border-border bg-white p-4">
          <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-charcoal">
            <span>Already mapped ({existingMappings.length})</span>
            {isSchool && (
              <Link
                href={`/admin/exams/${examId}/mapping/print-all`}
                target="_blank"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover"
              >
                <Printer className="size-3.5" strokeWidth={2} />
                Print all hall tickets
              </Link>
            )}
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <tbody>
                {existingMappings.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="py-1.5 font-mono text-charcoal">{m.rollNumber}</td>
                    <td className="py-1.5 text-charcoal">{m.fullName}</td>
                    <td className="py-1.5 text-slate">{m.hallLabel}</td>
                    <td className="py-1.5 font-mono text-slate">Seat {m.seatNumber}</td>
                    {isSchool && (
                      <td className="py-1.5 text-right">
                        <Link
                          href={`/admin/exams/${examId}/mapping/print/${m.id}`}
                          target="_blank"
                          className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover"
                        >
                          <Printer className="size-3.5" strokeWidth={2} />
                          Print
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {mode === "select" && (
        <>
          {examGroup && (
            <div className="rounded-lg border border-border bg-white p-5">
              <h2 className="text-sm font-semibold text-charcoal">Map to</h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label
                  className={`flex flex-1 cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                    scope === "exam" ? "border-accent bg-accent-tint" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="mapping-scope"
                    checked={scope === "exam"}
                    onChange={() => changeScope("exam")}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-semibold text-charcoal">This exam only</span>
                    <span className="block text-xs text-slate">Just this course&rsquo;s mapping.</span>
                  </span>
                </label>
                <label
                  className={`flex flex-1 cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                    scope === "group" ? "border-accent bg-accent-tint" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="mapping-scope"
                    checked={scope === "group"}
                    onChange={() => changeScope("group")}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-semibold text-charcoal">
                      Entire group — {examGroup.name}
                    </span>
                    <span className="block text-xs text-slate">
                      Same hall/seat across all {examGroup.exams.length} exams in this group.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border bg-white p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-charcoal">
                1. Select students ({selectedStudentIds.size} selected)
              </h2>
              <div className="flex flex-wrap gap-2">
                {rosterBatches.length > 0 && (
                  <select
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink"
                  >
                    <option value="all">Any roster upload</option>
                    {rosterBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label} ({b.studentIds.length})
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink"
                >
                  <option value="all">All departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex gap-3 text-sm font-semibold text-accent">
              <button
                onClick={() =>
                  setSelectedStudentIds(
                    (prev) => new Set([...prev, ...filteredStudents.map((s) => s.id)]),
                  )
                }
              >
                Select all filtered
              </button>
              <button onClick={() => setSelectedStudentIds(new Set())}>Clear selection</button>
            </div>

            <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-border">
              {filteredStudents.length === 0 ? (
                <p className="p-4 text-center text-sm text-slate">
                  No students left to map{scope === "group" ? " across this group" : ""}
                  {department !== "all" ? " in this department" : ""}.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {filteredStudents.map((s) => (
                      <tr
                        key={s.id}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-surface"
                        onClick={() => toggleStudent(s.id)}
                      >
                        <td className="w-8 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.has(s.id)}
                            onChange={() => toggleStudent(s.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-charcoal">{s.rollNumber}</td>
                        <td className="px-3 py-2 text-charcoal">{s.fullName}</td>
                        <td className="px-3 py-2 text-slate">{s.department}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-white p-5">
            <h2 className="text-sm font-semibold text-charcoal">
              2. Select halls ({selectedHallIds.length} selected, filled in this order)
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {halls.map((h) => (
                <label
                  key={h.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-charcoal"
                >
                  <input
                    type="checkbox"
                    checked={selectedHallIds.includes(h.id)}
                    onChange={() => toggleHall(h.id)}
                  />
                  {hallLabel(h)}
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate">
            Auto-allocate seats students from the same department apart where
            possible, so classmates aren&rsquo;t seated next to each other.
          </p>

          <div className="flex gap-3">
            <button
              onClick={buildAutoAllocated}
              disabled={selectedStudentIds.size === 0 || selectedHallIds.length === 0}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              Auto-allocate seats
            </button>
            <button
              onClick={buildManual}
              disabled={selectedStudentIds.size === 0}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-charcoal hover:bg-surface disabled:opacity-50"
            >
              Assign manually
            </button>
          </div>
        </>
      )}

      {mode === "review" && (
        <div className="rounded-lg border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold text-charcoal">
                3. Review &amp; confirm ({assignments.length})
              </h2>
              {examGroup && scope === "group" && (
                <p className="text-xs text-slate">
                  Each row maps to all {examGroup.exams.length} exams in {examGroup.name}.
                </p>
              )}
            </div>
            <button
              onClick={() => setMode("select")}
              className="text-sm font-semibold text-accent hover:text-accent-hover"
            >
              Back
            </button>
          </div>

          {reviewError && (
            <p className="mx-5 mt-4 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
              {reviewError}
            </p>
          )}

          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-wide text-slate">
                  <th className="px-4 py-2">Student</th>
                  <th className="px-4 py-2">Hall</th>
                  <th className="px-4 py-2">Seat</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr
                    key={a.studentId}
                    className={
                      a.status === "created"
                        ? "border-b border-border bg-verified-tint last:border-0"
                        : a.status === "error"
                          ? "border-b border-border bg-alert-tint last:border-0"
                          : a.status === "partial"
                            ? "border-b border-border bg-pending-tint last:border-0"
                            : "border-b border-border last:border-0"
                    }
                  >
                    <td className="px-4 py-2">
                      <span className="font-mono text-charcoal">{a.rollNumber}</span>{" "}
                      <span className="text-charcoal">{a.fullName}</span>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={a.hallId}
                        disabled={a.status === "created"}
                        onChange={(e) => updateAssignment(a.studentId, { hallId: e.target.value })}
                        className="rounded-lg border border-border px-2 py-1 text-sm text-ink"
                      >
                        <option value="">Select hall</option>
                        {halls.map((h) => (
                          <option key={h.id} value={h.id}>
                            {hallLabel(h)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={a.seatNumber}
                        disabled={a.status === "created"}
                        onChange={(e) =>
                          updateAssignment(a.studentId, { seatNumber: e.target.value })
                        }
                        className="w-20 rounded-lg border border-border px-2 py-1 font-mono text-sm text-ink"
                      />
                    </td>
                    <td className="px-4 py-2">
                      {a.status === "created" && (
                        <span className="text-verified">
                          {a.groupResults ? `Created (${a.groupResults.length}/${a.groupResults.length})` : "Created"}
                        </span>
                      )}
                      {a.status === "error" && <span className="text-alert">{a.error}</span>}
                      {a.status === "pending" && <span className="text-slate">Pending</span>}
                      {a.status === "partial" && a.groupResults && (
                        <span className="text-pending">
                          <span className="block font-semibold">
                            {a.groupResults.filter((r) => r.ok).length}/{a.groupResults.length} created
                          </span>
                          <span className="block text-xs">
                            {a.groupResults
                              .filter((r) => !r.ok)
                              .map((r) => `${r.courseCode}: ${r.error}`)
                              .join(" · ")}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {a.status !== "created" && (
                        <button
                          onClick={() => removeAssignment(a.studentId)}
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
            <button
              onClick={handleConfirm}
              disabled={pending || assignments.every((a) => a.status === "created")}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {pending ? "Generating passes…" : "Confirm & generate passes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
