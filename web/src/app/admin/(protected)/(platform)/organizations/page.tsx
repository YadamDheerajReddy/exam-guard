import { createClient } from "@/lib/supabase/server";
import { OrganizationForm } from "@/components/admin/organization-form";

export default async function OrganizationsPage() {
  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, type, created_at")
    .order("created_at", { ascending: false });

  const orgIds = orgs?.map((o) => o.id) ?? [];
  const { data: admins } = orgIds.length
    ? await supabase
        .from("admins")
        .select("organization_id, full_name, email")
        .in("organization_id", orgIds)
    : { data: [] };

  const adminsByOrg = new Map<string, { full_name: string; email: string }[]>();
  for (const a of admins ?? []) {
    if (!a.organization_id) continue;
    const list = adminsByOrg.get(a.organization_id) ?? [];
    list.push(a);
    adminsByOrg.set(a.organization_id, list);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Organizations</h1>
      <p className="mt-1 text-sm text-slate">Institutions using ExamGuard.</p>

      <div className="mt-6 rounded-lg border border-border bg-white p-5">
        <h2 className="text-sm font-semibold text-charcoal">Create an organization</h2>
        <OrganizationForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-white">
        {!orgs || orgs.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate">No organizations yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-wide text-slate">
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Admins</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => {
                const orgAdmins = adminsByOrg.get(org.id) ?? [];
                return (
                  <tr key={org.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-semibold text-ink">{org.name}</td>
                    <td className="px-4 py-3 text-charcoal">{org.type}</td>
                    <td className="px-4 py-3 text-charcoal">
                      {orgAdmins.length === 0
                        ? "—"
                        : orgAdmins.map((a) => `${a.full_name} (${a.email})`).join(", ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
