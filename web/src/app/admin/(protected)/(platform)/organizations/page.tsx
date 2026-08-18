import { createClient } from "@/lib/supabase/server";
import { OrganizationForm } from "@/components/admin/organization-form";
import { OrganizationsTable } from "@/components/admin/organizations-table";

export default async function OrganizationsPage() {
  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, type, is_suspended, created_at")
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

      <div className="mt-6">
        <OrganizationsTable
          orgs={(orgs ?? []).map((org) => ({
            id: org.id,
            name: org.name,
            type: org.type,
            isSuspended: org.is_suspended,
            admins: (adminsByOrg.get(org.id) ?? []).map((a) => ({ fullName: a.full_name, email: a.email })),
          }))}
        />
      </div>
    </div>
  );
}
