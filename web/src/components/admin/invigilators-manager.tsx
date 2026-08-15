"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  createInvigilator,
  reassignInvigilatorHall,
  setInvigilatorActive,
} from "@/app/admin/(protected)/(org)/invigilators/actions";

type Hall = { id: string; buildingName: string; roomNumber: string };
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
        <form ref={formRef} action={formAction} className="mt-3 grid grid-cols-3 gap-3">
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
            {halls.map((h) => (
              <option key={h.id} value={h.id}>
                {h.buildingName} · {h.roomNumber}
              </option>
            ))}
          </select>

          {state && "error" in state && (
            <p className="col-span-3 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
              {state.error}
            </p>
          )}

          {state && "success" in state && (
            <div className="col-span-3 rounded-lg bg-verified-tint px-3 py-3 text-sm text-verified">
              <p>
                Login: <span className="font-mono">{state.email}</span> · Temp password:{" "}
                <span className="font-mono">{state.tempPassword}</span>
              </p>
              <p className="mt-1 text-xs">Shown once — copy it now and share it securely.</p>
            </div>
          )}

          <div className="col-span-3">
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

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        {invigilators.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate">No invigilators yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-wide text-slate">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Assigned hall</th>
                <th className="px-4 py-3">Status</th>
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

  return (
    <tr className="border-b border-border last:border-0">
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
          {halls.map((h) => (
            <option key={h.id} value={h.id}>
              {h.buildingName} · {h.roomNumber}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <span className={invigilator.isActive ? "text-verified" : "text-inactive"}>
          {invigilator.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {error && <span className="mr-3 text-xs text-alert">{error}</span>}
        <button
          onClick={handleToggleActive}
          disabled={pending}
          className="text-sm font-semibold text-accent hover:text-accent-hover disabled:opacity-50"
        >
          {invigilator.isActive ? "Deactivate" : "Activate"}
        </button>
      </td>
    </tr>
  );
}
