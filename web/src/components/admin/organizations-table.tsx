"use client";

import { useState, useTransition } from "react";
import { setOrganizationSuspended } from "@/app/admin/(protected)/(platform)/organizations/actions";
import { AlertCircle, Ban, Building, CheckCircle2 } from "lucide-react";

type Org = {
  id: string;
  name: string;
  type: string;
  isSuspended: boolean;
  admins: { fullName: string; email: string }[];
};

export function OrganizationsTable({ orgs }: { orgs: Org[] }) {
  return (
    <div className="overflow-x-auto overflow-hidden rounded-lg border border-border bg-white">
      {orgs.length === 0 ? (
        <div className="p-10 text-center">
          <Building className="mx-auto size-8 text-slate" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-slate">No organizations yet.</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-wide text-slate">
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Admins</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <OrgRow key={org.id} org={org} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function OrgRow({ org }: { org: Org }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await setOrganizationSuspended(org.id, !org.isSuspended);
      if (result.error) setError(result.error);
    });
  }

  return (
    <tr className="border-b border-border transition-colors last:border-0 hover:bg-surface">
      <td className="px-4 py-3 font-semibold text-ink">{org.name}</td>
      <td className="px-4 py-3 text-charcoal">{org.type}</td>
      <td className="px-4 py-3 text-charcoal">
        {org.admins.length === 0 ? "—" : org.admins.map((a) => `${a.fullName} (${a.email})`).join(", ")}
      </td>
      <td className="px-4 py-3">
        <span className={`flex w-fit items-center gap-1.5 ${org.isSuspended ? "text-alert" : "text-verified"}`}>
          {org.isSuspended ? <Ban className="size-4" strokeWidth={2} /> : <CheckCircle2 className="size-4" strokeWidth={2} />}
          {org.isSuspended ? "On hold" : "Active"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {error && (
          <span className="mr-3 inline-flex items-center gap-1 text-xs text-alert">
            <AlertCircle className="size-3.5" strokeWidth={2} />
            {error}
          </span>
        )}
        <button
          onClick={handleToggle}
          disabled={pending}
          className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
            org.isSuspended ? "text-verified hover:text-verified" : "text-alert hover:text-alert"
          }`}
        >
          {org.isSuspended ? <CheckCircle2 className="size-3.5" strokeWidth={2} /> : <Ban className="size-3.5" strokeWidth={2} />}
          {pending ? "Saving…" : org.isSuspended ? "Reinstate" : "Hold"}
        </button>
      </td>
    </tr>
  );
}
