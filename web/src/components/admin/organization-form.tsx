"use client";

import { useActionState, useEffect, useRef } from "react";
import { createOrganizationWithAdmin } from "@/app/admin/(protected)/(platform)/organizations/actions";

export function OrganizationForm() {
  const [state, formAction, pending] = useActionState(createOrganizationWithAdmin, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "success" in state) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <div className="mt-3">
      <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="orgName"
          placeholder="Organization name"
          required
          className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />
        <select
          name="orgType"
          defaultValue="COLLEGE"
          className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        >
          <option value="COLLEGE">College</option>
          <option value="UNIVERSITY">University</option>
          <option value="SCHOOL">School</option>
          <option value="OTHER">Other</option>
        </select>
        <input
          name="adminFullName"
          placeholder="Admin full name"
          required
          className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />
        <input
          name="adminEmail"
          type="email"
          placeholder="Admin email"
          required
          className="rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />

        {state && "error" in state && (
          <p className="sm:col-span-2 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
            {state.error}
          </p>
        )}

        {state && "success" in state && (
          <div className="sm:col-span-2 rounded-lg bg-verified-tint px-3 py-3 text-sm text-verified">
            <p className="font-semibold">{state.orgName} created.</p>
            <p className="mt-1">
              Admin login: <span className="font-mono">{state.adminEmail}</span>
            </p>
            <p className="mt-1">
              Temp password: <span className="font-mono">{state.tempPassword}</span>
            </p>
            <p className="mt-2 text-xs">
              This password is shown once — copy it now and share it with the admin securely.
            </p>
          </div>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create organization"}
          </button>
        </div>
      </form>
    </div>
  );
}
