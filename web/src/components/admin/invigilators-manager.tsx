"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  createInvigilator,
  reassignInvigilatorHall,
  resetInvigilatorPassword,
  setInvigilatorActive,
} from "@/app/admin/(protected)/(org)/invigilators/actions";
import { MAX_INVIGILATORS_PER_HALL } from "@/lib/hall-capacity";
import { AlertCircle, CheckCircle2, KeyRound, ShieldCheck, ShieldOff, ShieldX } from "lucide-react";

type Hall = { id: string; buildingName: string; roomNumber: string; activeCount: number };
type Invigilator = {
  id: string;
  fullName: string;
  email: string;
  assignedHallId: string | null;
  isActive: boolean;
};

export function InvigilatorsManager({
  halls,
  invigilators,
}: {
  halls: Hall[];
  invigilators: Invigilator[];
}) {
  const [state, formAction, pending] = useActionState(createInvigilator, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "success" in state) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-white p-5">
        <h2 className="text-sm font-semibold text-charcoal">Add an invigilator</h2>
        <form ref={formRef} action={formAction} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input
            name="fullName"
            placeholder="Full name"
            required
            className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
          />
          <select
            name="assignedHallId"
            defaultValue=""
            className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
          >
            <option value="">Unassigned hall</option>
            {halls.map((h) => {
              const full = h.activeCount >= MAX_INVIGILATORS_PER_HALL;
              return (
                <option key={h.id} value={h.id} disabled={full}>
                  {h.buildingName} · {h.roomNumber} ({h.activeCount}/{MAX_INVIGILATORS_PER_HALL}
                  {full ? " · full" : ""})
                </option>
              );
            })}
          </select>

          {state && "error" in state && (
            <p className="sm:col-span-2 lg:col-span-3 animate-in fade-in flex items-center gap-2 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
              <AlertCircle className="size-4 shrink-0" strokeWidth={2} />
              {state.error}
            </p>
          )}

          {state && "success" in state && (
            <div className="sm:col-span-2 lg:col-span-3 animate-in fade-in slide-in-from-top-1 flex items-start gap-2.5 rounded-lg bg-verified-tint px-3 py-3 text-sm text-verified duration-200">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              <div>
                <p>
                  Login: <span className="font-mono">{state.email}</span> · Temp password:{" "}
                  <span className="font-mono">{state.tempPassword}</span>
                </p>
                <p className="mt-1 text-xs">Shown once — copy it now and share it securely.</p>
              </div>
            </div>
          )}

          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {pending ? "Adding…" : "Add invigilator"}
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-x-auto overflow-hidden rounded-lg border border-border bg-white">
        {invigilators.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldCheck className="mx-auto size-8 text-slate" strokeWidth={1.5} />
            <p className="mt-3 text-sm text-slate">No invigilators yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-wide text-slate">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Assigned hall</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Credentials</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invigilators.map((inv) => (
                <InvigilatorRow key={inv.id} invigilator={inv} halls={halls} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function InvigilatorRow({
  invigilator,
  halls,
}: {
  invigilator: Invigilator;
  halls: Hall[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resetState, setResetState] = useState<
    { status: "pending" } | { status: "done"; tempPassword: string } | { status: "error"; error: string } | null
  >(null);

  function handleHallChange(hallId: string) {
    setError(null);
    startTransition(async () => {
      const result = await reassignInvigilatorHall(invigilator.id, hallId);
      if (result.error) setError(result.error);
    });
  }

  function handleToggleActive() {
    setError(null);
    startTransition(async () => {
      const result = await setInvigilatorActive(invigilator.id, !invigilator.isActive);
      if (result.error) setError(result.error);
    });
  }

  function handleResetPassword() {
    setResetState({ status: "pending" });
    startTransition(async () => {
      const result = await resetInvigilatorPassword(invigilator.id);
      setResetState(
        result.ok ? { status: "done", tempPassword: result.tempPassword } : { status: "error", error: result.error },
      );
    });
  }

  return (
    <tr className="border-b border-border transition-colors last:border-0 hover:bg-surface">
      <td className="px-4 py-3 text-ink">{invigilator.fullName}</td>
      <td className="px-4 py-3 text-charcoal">{invigilator.email}</td>
      <td className="px-4 py-3">
        <select
          defaultValue={invigilator.assignedHallId ?? ""}
          disabled={pending}
          onChange={(e) => handleHallChange(e.target.value)}
          className="rounded-lg border border-border px-2 py-1 text-sm text-ink"
        >
          <option value="">Unassigned</option>
          {halls.map((h) => {
            // This invigilator already occupies one of the hall's slots if
            // it's their current assignment, so that hall must never show
            // as full to them — otherwise the dropdown couldn't even
            // display their own existing selection.
            const isCurrent = h.id === invigilator.assignedHallId;
            const effectiveCount = h.activeCount - (isCurrent ? 1 : 0);
            const full = !isCurrent && invigilator.isActive && effectiveCount >= MAX_INVIGILATORS_PER_HALL;
            return (
              <option key={h.id} value={h.id} disabled={full}>
                {h.buildingName} · {h.roomNumber} ({h.activeCount}/{MAX_INVIGILATORS_PER_HALL}
                {full ? " · full" : ""})
              </option>
            );
          })}
        </select>
      </td>
      <td className="px-4 py-3">
        <span
          className={`flex items-center gap-1.5 ${invigilator.isActive ? "text-verified" : "text-inactive"}`}
        >
          {invigilator.isActive ? (
            <ShieldCheck className="size-4" strokeWidth={2} />
          ) : (
            <ShieldOff className="size-4" strokeWidth={2} />
          )}
          {invigilator.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3">
        {resetState?.status === "done" ? (
          <span className="font-mono text-verified">New password: {resetState.tempPassword}</span>
        ) : resetState?.status === "error" ? (
          <span className="text-alert">{resetState.error}</span>
        ) : (
          <button
            onClick={handleResetPassword}
            disabled={resetState?.status === "pending"}
            className="flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent-hover disabled:opacity-60"
          >
            <KeyRound className="size-3.5" strokeWidth={2} />
            {resetState?.status === "pending" ? "Resetting…" : "Reset password"}
          </button>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {error && (
          <span className="mr-3 inline-flex items-center gap-1 text-xs text-alert">
            <AlertCircle className="size-3.5" strokeWidth={2} />
            {error}
          </span>
        )}
        <button
          onClick={handleToggleActive}
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent-hover disabled:opacity-50"
        >
          {invigilator.isActive ? <ShieldX className="size-3.5" strokeWidth={2} /> : <ShieldCheck className="size-3.5" strokeWidth={2} />}
          {invigilator.isActive ? "Deactivate" : "Activate"}
        </button>
      </td>
    </tr>
  );
}
