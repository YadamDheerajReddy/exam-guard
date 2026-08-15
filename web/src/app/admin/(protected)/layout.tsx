import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminLogout } from "../actions";
import { AdminNav } from "@/components/admin/nav";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!admin) {
    await supabase.auth.signOut();
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
        <div>
          <p className="text-sm font-bold text-ink">ExamGuard Admin</p>
          <p className="text-xs text-slate">
            {admin.full_name} · {admin.role}
          </p>
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
