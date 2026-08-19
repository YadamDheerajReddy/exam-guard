"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteExam, updateExam } from "@/app/admin/(protected)/(org)/exams/actions";
import { ExamForm } from "@/components/admin/exam-form";
import { type ExamStatus } from "@/lib/reveal";
import { AlertCircle, CalendarDays, Pencil, Trash2, Users } from "lucide-react";

export type AdminExam = {
  id: string;
  courseCode: string;
  courseTitle: string;
  examDate: string;
  startTime: string;
  endTime: string;
  revealThresholdMinutes: number;
  status: ExamStatus;
  mapped: number;
};

const STATUS_LABEL: Record<ExamStatus, string> = {
  upcoming: "Upcoming",
  "pass-ready": "Pass ready",
  completed: "Completed",
};

const STATUS_CLASS: Record<ExamStatus, string> = {
  upcoming: "bg-surface text-charcoal",
  "pass-ready": "bg-verified-tint text-verified",
  completed: "bg-inactive-tint text-inactive",
};

export function ExamsManager({ exams, timeZone }: { exams: AdminExam[]; timeZone: string }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (exams.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white p-10 text-center shadow-sm">
        <CalendarDays className="mx-auto size-8 text-slate" strokeWidth={1.5} />
        <p className="mt-3 text-sm text-slate">No exams yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <ul className="divide-y divide-border">
        {exams.map((exam) =>
          editingId === exam.id ? (
            <li key={exam.id} className="bg-surface p-5">
              <p className="text-sm font-semibold text-charcoal">Edit {exam.courseCode}</p>
              <ExamForm
                timeZone={timeZone}
                action={updateExam.bind(null, exam.id)}
                submitLabel="Save changes"
                defaultValues={exam}
                onDone={() => setEditingId(null)}
              />
            </li>
          ) : (
            <ExamRow key={exam.id} exam={exam} onEdit={() => setEditingId(exam.id)} />
          ),
        )}
      </ul>
    </div>
  );
}

function ExamRow({ exam, onEdit }: { exam: AdminExam; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteExam(exam.id);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  return (
    <li className="p-4 transition-colors hover:bg-surface">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-ink">{exam.courseCode}</p>
            <span
              className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[exam.status]}`}
            >
              {STATUS_LABEL[exam.status]}
            </span>
          </div>
          <p className="truncate text-xs text-slate">{exam.courseTitle}</p>
          <p className="mt-1 text-xs text-slate">
            {exam.examDate} · <span className="font-mono">{exam.startTime}–{exam.endTime}</span> · reveals T-
            {exam.revealThresholdMinutes}m
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <span className="flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-xs font-semibold text-charcoal">
            <Users className="size-3.5 text-slate" strokeWidth={2} />
            {exam.mapped}
          </span>
          <Link
            href={`/admin/exams/${exam.id}/mapping`}
            className="text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
          >
            Map students
          </Link>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
          >
            <Pencil className="size-3.5" strokeWidth={2} />
            Edit
          </button>
          {confirming ? (
            <span className="inline-flex items-center gap-2 text-xs">
              <span className="text-charcoal">Delete?</span>
              <button
                onClick={handleDelete}
                disabled={pending}
                className="font-semibold text-alert disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Yes"}
              </button>
              <button onClick={() => setConfirming(false)} className="font-semibold text-slate">
                No
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-alert transition-colors"
            >
              <Trash2 className="size-3.5" strokeWidth={2} />
              Delete
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-alert-tint px-3 py-2 text-xs text-alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
          {error}
        </p>
      )}
    </li>
  );
}
