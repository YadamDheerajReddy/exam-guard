"use client";

import { useActionState, useState, useTransition } from "react";
import { createHall, deleteHall, updateHall, type HallFormState } from "@/app/admin/(protected)/halls/actions";

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

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        {initialHalls.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate">No halls yet.</p>
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
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3 text-ink">{hall.building_name}</td>
      <td className="px-4 py-3 font-mono text-charcoal">{hall.room_number}</td>
      <td className="px-4 py-3 text-charcoal">{hall.floor_level}</td>
      <td className="px-4 py-3 text-charcoal">{hall.capacity}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3">
          {error && <span className="text-xs text-alert">{error}</span>}
          <button
            onClick={onEdit}
            className="text-sm font-semibold text-accent hover:text-accent-hover"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={pending}
            className="text-sm font-semibold text-alert disabled:opacity-50"
          >
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
    <form action={formAction} className="mt-3 grid grid-cols-4 gap-3">
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
        <p className="col-span-4 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
          {state.error}
        </p>
      )}

      <div className="col-span-4 flex gap-2">
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
