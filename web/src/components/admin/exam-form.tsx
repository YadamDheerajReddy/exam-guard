"use client";

import { useActionState, useMemo, useState } from "react";
import { createExam } from "@/app/admin/(protected)/exams/actions";

function revealPreview(examDate: string, startTime: string, thresholdMinutes: number) {
  if (!examDate || !startTime || !Number.isFinite(thresholdMinutes)) return null;

  const start = new Date(`${examDate}T${startTime}`);
  if (Number.isNaN(start.getTime())) return null;

  const reveal = new Date(start.getTime() - thresholdMinutes * 60_000);
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return `Students will see their hall at ${timeFormatter.format(reveal)} for a ${timeFormatter.format(start)} exam.`;
}

export function ExamForm() {
  const [state, formAction, pending] = useActionState(createExam, undefined);
  const [examDate, setExamDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [thresholdMinutes, setThresholdMinutes] = useState(30);

  const preview = useMemo(
    () => revealPreview(examDate, startTime, thresholdMinutes),
    [examDate, startTime, thresholdMinutes],
  );

  return (
    <form action={formAction} className="mt-3 grid grid-cols-2 gap-4">
      <input
        name="courseCode"
        placeholder="Course code (e.g. CS301)"
        required
        className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
      />
      <input
        name="courseTitle"
        placeholder="Course title"
        required
        className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
      />
      <input
        name="examDate"
        type="date"
        required
        value={examDate}
        onChange={(e) => setExamDate(e.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          name="startTime"
          type="time"
          required
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />
        <input
          name="endTime"
          type="time"
          required
          className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />
      </div>

      <div className="col-span-2 flex flex-col gap-1.5">
        <label htmlFor="revealThresholdMinutes" className="text-sm font-semibold text-charcoal">
          Reveal hall/seat this many minutes before start
        </label>
        <input
          id="revealThresholdMinutes"
          name="revealThresholdMinutes"
          type="number"
          min={0}
          value={thresholdMinutes}
          onChange={(e) => setThresholdMinutes(Number(e.target.value))}
          className="w-32 rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />
      </div>

      {preview && (
        <p className="col-span-2 rounded-lg bg-accent-tint px-3 py-2 text-sm text-accent">
          {preview}
        </p>
      )}

      {state?.error && (
        <p className="col-span-2 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
          {state.error}
        </p>
      )}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create exam"}
        </button>
      </div>
    </form>
  );
}
