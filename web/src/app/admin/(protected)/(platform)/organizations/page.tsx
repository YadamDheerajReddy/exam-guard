import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformDashboard } from "@/components/admin/platform-dashboard";

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

  // Super admins have no RLS path to students/invigilators/halls/exams
  // (org-scoped tables) — service role for these read-only aggregate
  // counts, same justified pattern as other cross-tenant reads in this
  // codebase. Only organization_id + head-counts are fetched, never row
  // data, so no student/invigilator PII crosses this boundary.
  const service = createAdminClient();
  const [studentRows, invigilatorRows, examCount, hallCount] = await Promise.all([
    service.from("students").select("organization_id"),
    service.from("invigilators").select("organization_id"),
    service.from("exams").select("id", { count: "exact", head: true }),
    service.from("halls").select("id", { count: "exact", head: true }),
  ]);

  const studentsByOrg = new Map<string, number>();
  for (const s of studentRows.data ?? []) {
    studentsByOrg.set(s.organization_id, (studentsByOrg.get(s.organization_id) ?? 0) + 1);
  }
  const invigilatorsByOrg = new Map<string, number>();
  for (const i of invigilatorRows.data ?? []) {
    invigilatorsByOrg.set(i.organization_id, (invigilatorsByOrg.get(i.organization_id) ?? 0) + 1);
  }

  const orgsForDashboard = (orgs ?? []).map((org) => ({
    id: org.id,
    name: org.name,
    type: org.type,
    isSuspended: org.is_suspended,
    createdAt: org.created_at,
    admins: (adminsByOrg.get(org.id) ?? []).map((a) => ({ fullName: a.full_name, email: a.email })),
    studentCount: studentsByOrg.get(org.id) ?? 0,
    invigilatorCount: invigilatorsByOrg.get(org.id) ?? 0,
  }));

  return (
    <PlatformDashboard
      orgs={orgsForDashboard}
      totals={{
        organizations: orgsForDashboard.length,
        active: orgsForDashboard.filter((o) => !o.isSuspended).length,
        onHold: orgsForDashboard.filter((o) => o.isSuspended).length,
        admins: admins?.length ?? 0,
        students: studentRows.data?.length ?? 0,
        invigilators: invigilatorRows.data?.length ?? 0,
        exams: examCount.count ?? 0,
        halls: hallCount.count ?? 0,
      }}
    />
  );
}
