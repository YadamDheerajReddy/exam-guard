import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/admin-context";
import { adminLogout } from "../../actions";
import { AdminNav } from "@/components/admin/nav";
import { MobileSidebar } from "@/components/admin/mobile-sidebar";
import { Logo } from "@/components/logo";
import { LogOut } from "lucide-react";

export default async function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/admin/login");
  }

  if (admin.role === "SUPER_ADMIN") {
    redirect("/admin/organizations");
  }

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, slug, logo_url")
    .eq("id", admin.organizationId!)
    .maybeSingle();

  // mustChangePassword and a missing slug are set/cleared together in the
  // normal flow, but check both — a missing Organization ID on its own is
  // reason enough to block roster/mapping features either way.
  if (admin.mustChangePassword || !org?.slug) {
    redirect("/admin/change-password");
  }

  // org-logos is a private bucket with no storage.objects policies (same
  // pattern as student-photos) — signing always goes through the
  // service-role client.
  const service = createAdminClient();

  let orgLogoUrl: string | null = null;
  if (org.logo_url) {
    const { data: signed } = await service.storage.from("org-logos").createSignedUrl(org.logo_url, 300);
    orgLogoUrl = signed?.signedUrl ?? null;
  }

  // data_rights_requests has RLS enabled with zero policies (see
  // data-requests/page.tsx) — the cookie-scoped client would silently see
  // nothing here, so this counts via the service client, explicitly scoped
  // to this admin's own org.
  const { count: pendingDataRequests } = await service
    .from("data_rights_requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", admin.organizationId!)
    .eq("status", "PENDING");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-white px-4 py-4 print:hidden sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <MobileSidebar>
            <AdminNav dataRequestsCount={pendingDataRequests ?? 0} />
          </MobileSidebar>
          {orgLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL
            <img src={orgLogoUrl} alt="" className="size-[22px] shrink-0 rounded object-contain" />
          ) : (
            <Logo size={22} withWordmark={false} />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{org?.name ?? "ExamGuard Admin"}</p>
            <p className="truncate text-xs text-slate">
              {admin.fullName} · {admin.role}
              {org?.slug && (
                <>
                  {" "}
                  · Organization ID: <span className="font-mono text-charcoal">{org.slug}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <form action={adminLogout} className="shrink-0">
          <button className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-surface">
            <LogOut className="size-4" strokeWidth={2} />
            Sign out
          </button>
        </form>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-white px-3 py-6 print:hidden md:block">
          <AdminNav dataRequestsCount={pendingDataRequests ?? 0} />
        </aside>
        <main className="min-w-0 flex-1 bg-surface px-4 py-6 print:bg-white print:p-0 sm:px-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
