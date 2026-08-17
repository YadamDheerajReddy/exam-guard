import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/admin-context";
import { adminLogout } from "../../actions";
import { PlatformNav } from "@/components/admin/platform-nav";
import { Logo } from "@/components/logo";

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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Logo size={22} withWordmark={false} />
          <div>
            <p className="text-sm font-bold text-ink">ExamGuard Platform</p>
            <p className="text-xs text-slate">{admin.fullName} · Super Admin</p>
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
          <PlatformNav />
        </aside>
        <main className="flex-1 bg-surface px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
