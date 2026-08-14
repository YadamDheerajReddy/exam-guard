import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminLogout } from "./actions";

export default async function AdminHomePage() {
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
    // Signed in, but no admins row for this account — wrong portal for this identity.
    await supabase.auth.signOut();
    redirect("/admin/login");
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-bold text-ink">Admin Console</h1>
            <p className="text-sm text-slate">
              Welcome, {admin.full_name} · {admin.role}
            </p>
          </div>
          <form action={adminLogout}>
            <button className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-surface">
              Sign out
            </button>
          </form>
        </header>

        <div className="mt-8 rounded-lg border border-dashed border-border bg-white p-10 text-center">
          <p className="text-sm text-slate">
            Phase 0 complete. Roster upload, hall management, exam creation,
            and seat mapping land in Phase 1.
          </p>
        </div>
      </div>
    </main>
  );
}
