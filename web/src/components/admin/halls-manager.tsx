"use client";

import { useActionState, useState, useTransition } from "react";
import { createHall, deleteHall, updateHall, type HallFormState } from "@/app/admin/(protected)/(org)/halls/actions";
import { AlertCircle, Building2, Pencil, Trash2 } from "lucide-react";

type Hall = {
  id: string;
  building_name: string;
  room_number: string;
  floor_level: number;
  capacity: number;
};

export function HallsManager({ initialHalls }: { initialHalls: Hall[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-white p-5">
        <h2 className="text-sm font-semibold text-charcoal">Add a hall</h2>
        <HallForm action={createHall} submitLabel="Add hall" />
      </div>

      <div className="overflow-x-auto overflow-hidden rounded-lg border border-border bg-white">
        {initialHalls.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 className="mx-auto size-8 text-slate" strokeWidth={1.5} />
            <p className="mt-3 text-sm text-slate">No halls yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-wide text-slate">
                <th className="px-4 py-3">Building</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Floor</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {initialHalls.map((hall) =>
                editingId === hall.id ? (
                  <tr key={hall.id} className="border-b border-border last:border-0">
                    <td colSpan={5} className="px-4 py-4">
                      <HallForm
                        action={updateHall.bind(null, hall.id)}
                        submitLabel="Save"
                        defaultValues={hall}
                        onDone={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <HallRow
                    key={hall.id}
                    hall={hall}
                    onEdit={() => setEditingId(hall.id)}
                  />
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function HallRow({ hall, onEdit }: { hall: Hall; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteHall(hall.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <tr className="border-b border-border transition-colors last:border-0 hover:bg-surface">
      <td className="px-4 py-3 text-ink">{hall.building_name}</td>
      <td className="px-4 py-3 font-mono text-charcoal">{hall.room_number}</td>
      <td className="px-4 py-3 text-charcoal">{hall.floor_level}</td>
      <td className="px-4 py-3 text-charcoal">{hall.capacity}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3">
          {error && (
            <span className="inline-flex items-center gap-1 text-xs text-alert">
              <AlertCircle className="size-3.5" strokeWidth={2} />
              {error}
            </span>
          )}
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
          >
            <Pencil className="size-3.5" strokeWidth={2} />
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-alert transition-colors disabled:opacity-50"
          >
            <Trash2 className="size-3.5" strokeWidth={2} />
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function HallForm({
  action,
  submitLabel,
  defaultValues,
  onDone,
}: {
  action: (state: HallFormState, formData: FormData) => Promise<HallFormState>;
  submitLabel: string;
  defaultValues?: Hall;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prevState: HallFormState, formData: FormData) => {
      const result = await action(prevState, formData);
      if (!result?.error) onDone?.();
      return result;
    },
    undefined,
  );

  return (
    <form action={formAction} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input
        name="buildingName"
        placeholder="Building name"
        defaultValue={defaultValues?.building_name}
        required
        className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
      />
      <input
        name="roomNumber"
        placeholder="Room number"
        defaultValue={defaultValues?.room_number}
        required
        className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
      />
      <input
        name="floorLevel"
        type="number"
        placeholder="Floor"
        defaultValue={defaultValues?.floor_level}
        required
        className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
      />
      <input
        name="capacity"
        type="number"
        min={1}
        placeholder="Capacity"
        defaultValue={defaultValues?.capacity}
        required
        className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
      />

      {state?.error && (
        <p className="sm:col-span-2 lg:col-span-4 animate-in fade-in flex items-center gap-2 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2} />
          {state.error}
        </p>
      )}

      <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
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
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-charcoal hover:bg-surface"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
