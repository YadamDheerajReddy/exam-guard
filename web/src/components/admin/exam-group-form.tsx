"use client";

import { useActionState, useRef } from "react";
import { createExamGroup } from "@/app/admin/(protected)/(org)/exams/actions";

export function ExamGroupForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prevState: Awaited<ReturnType<typeof createExamGroup>>, formData: FormData) => {
      const result = await createExamGroup(prevState, formData);
      if (!result?.error) formRef.current?.reset();
      return result;
    },
    undefined,
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        name="name"
        placeholder="Group name (e.g. Mid-term Exams)"
        required
        className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
      />
      <button
        type="submit"
        disabled={pending}
        className="whitespace-nowrap rounded-lg border border-border px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-surface disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add group"}
      </button>
      {state?.error && <p className="text-sm text-alert sm:ml-2">{state.error}</p>}
    </form>
  );
}
