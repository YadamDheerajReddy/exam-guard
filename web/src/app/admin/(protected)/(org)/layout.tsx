import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/admin-context";
import { adminLogout } from "../../actions";
import { AdminNav } from "@/components/admin/nav";
import { Logo } from "@/components/logo";

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
    .select("name, slug")
    .eq("id", admin.organizationId!)
    .maybeSingle();

  // mustChangePassword and a missing slug are set/cleared together in the
  // normal flow, but check both — a missing Organization ID on its own is
  // reason enough to block roster/mapping features either way.
  if (admin.mustChangePassword || !org?.slug) {
    redirect("/admin/change-password");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Logo size={22} withWordmark={false} />
          <div>
            <p className="text-sm font-bold text-ink">{org?.name ?? "ExamGuard Admin"}</p>
            <p className="text-xs text-slate">
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
        <form action={adminLogout}>
          <button className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-surface">
            Sign out
          </button>
        </form>
      </header>

      <div className="flex flex-1">
        <aside className="w-56 shrink-0 border-r border-border bg-white px-3 py-6">
          <AdminNav />
        </aside>
        <main className="flex-1 bg-surface px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
