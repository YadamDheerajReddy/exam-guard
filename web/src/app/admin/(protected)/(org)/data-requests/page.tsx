import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAdmin } from "@/lib/admin-context";
import { DataRequestsManager } from "@/components/admin/data-requests-manager";

export default async function DataRequestsPage() {
  const admin = await requireOrgAdmin();
  // data_rights_requests has RLS enabled with zero policies (matches
  // password_reset_tokens) — the cookie-scoped client would silently see
  // nothing here, so this reads via the service client, explicitly scoped
  // to this admin's own org rather than relying on RLS to do that scoping.
  const service = createAdminClient();

  const { data: requests } = await service
    .from("data_rights_requests")
    .select("id, student_roll_number, student_full_name, request_type, details, status, resolution_notes, requested_at, resolved_at")
    .eq("organization_id", admin.organizationId)
    .order("requested_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Data Rights Requests</h1>
      <p className="mt-1 text-sm text-slate">
        Access, correction, and erasure requests students have submitted under the DPDP Act, 2023.
      </p>

      <div className="mt-6">
        <DataRequestsManager
          requests={(requests ?? []).map((r) => ({
            id: r.id,
            rollNumber: r.student_roll_number,
            fullName: r.student_full_name,
            requestType: r.request_type as "ACCESS" | "CORRECTION" | "ERASURE",
            details: r.details,
            status: r.status as "PENDING" | "COMPLETED" | "REJECTED",
            resolutionNotes: r.resolution_notes,
            requestedAt: r.requested_at,
          }))}
        />
      </div>
    </div>
  );
}
