import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/admin-context";
import { adminLogout } from "../../actions";
import { PlatformNav } from "@/components/admin/platform-nav";
import { MobileSidebar } from "@/components/admin/mobile-sidebar";
import { Logo } from "@/components/logo";
import { LogOut } from "lucide-react";

export default async function PlatformAdminLayout({
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

  if (admin.role !== "SUPER_ADMIN") {
    redirect("/admin");
  }

  const supabase = await createClient();
  const { count: pendingChangeRequests } = await supabase
    .from("change_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDING");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-white px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <MobileSidebar>
            <PlatformNav changeRequestsCount={pendingChangeRequests ?? 0} />
          </MobileSidebar>
          <Logo size={22} withWordmark={false} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">ExamGuard Platform</p>
            <p className="truncate text-xs text-slate">{admin.fullName} · Super Admin</p>
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
        <aside className="hidden w-56 shrink-0 border-r border-border bg-white px-3 py-6 md:block">
          <PlatformNav changeRequestsCount={pendingChangeRequests ?? 0} />
        </aside>
        <main className="min-w-0 flex-1 bg-surface px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
