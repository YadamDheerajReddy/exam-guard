"use client";

import { useActionState, useMemo, useState } from "react";
import { createExam, type ExamFormState } from "@/app/admin/(protected)/(org)/exams/actions";
import { zonedDateTimeToUtc } from "@/lib/timezone";

// Mirrors the server's reveal maths (lib/reveal.ts) rather than parsing the
// times in the admin's own browser zone — otherwise an admin working from a
// different timezone than their institution would be shown a reveal time
// that doesn't match what students actually get.
function revealPreview(examDate: string, startTime: string, thresholdMinutes: number, timeZone: string) {
  if (!examDate || !startTime || !Number.isFinite(thresholdMinutes)) return null;

  const start = zonedDateTimeToUtc(examDate, startTime, timeZone);
  if (Number.isNaN(start.getTime())) return null;

  const reveal = new Date(start.getTime() - thresholdMinutes * 60_000);
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });

  return `Students will see their hall at ${timeFormatter.format(reveal)} for a ${timeFormatter.format(start)} exam (${timeZone.replace(/_/g, " ")}).`;
}

type ExamDefaults = {
  courseCode: string;
  courseTitle: string;
  examDate: string;
  startTime: string;
  endTime: string;
  revealThresholdMinutes: number;
};

export function ExamForm({
  timeZone,
  action = createExam,
  submitLabel = "Create exam",
  defaultValues,
  onDone,
}: {
  timeZone: string;
  action?: (state: ExamFormState, formData: FormData) => Promise<ExamFormState>;
  submitLabel?: string;
  defaultValues?: ExamDefaults;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prevState: ExamFormState, formData: FormData) => {
      const result = await action(prevState, formData);
      if (!result?.error) onDone?.();
      return result;
    },
    undefined,
  );
  const [examDate, setExamDate] = useState(defaultValues?.examDate ?? "");
  const [startTime, setStartTime] = useState(defaultValues?.startTime ?? "");
  const [thresholdMinutes, setThresholdMinutes] = useState(defaultValues?.revealThresholdMinutes ?? 30);

  const preview = useMemo(
    () => revealPreview(examDate, startTime, thresholdMinutes, timeZone),
    [examDate, startTime, thresholdMinutes, timeZone],
  );

  return (
    <form action={formAction} className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input
        name="courseCode"
        placeholder="Course code (e.g. CS301)"
        required
        defaultValue={defaultValues?.courseCode}
        className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
      />
      <input
        name="courseTitle"
        placeholder="Course title"
        required
        defaultValue={defaultValues?.courseTitle}
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
          defaultValue={defaultValues?.endTime}
          className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />
      </div>

      <div className="sm:col-span-2 flex flex-col gap-1.5">
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
        <p className="sm:col-span-2 rounded-lg bg-accent-tint px-3 py-2 text-sm text-accent">
          {preview}
        </p>
      )}

      {state?.error && (
        <p className="sm:col-span-2 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
          {state.error}
        </p>
      )}

      <div className="sm:col-span-2 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-white"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
