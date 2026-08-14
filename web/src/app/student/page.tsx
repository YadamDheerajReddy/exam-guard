import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { studentLogout } from "./actions";

export default async function StudentHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/student/login");
  }

  const { data: student } = await supabase
    .from("students")
    .select("full_name, roll_number")
    .eq("id", user.id)
    .maybeSingle();

  if (!student) {
    // Signed in, but no students row for this account — wrong portal for this identity.
    await supabase.auth.signOut();
    redirect("/student/login");
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-bold text-ink">Student Portal</h1>
            <p className="text-sm text-slate">
              Welcome, {student.full_name} ·{" "}
              <span className="font-mono">{student.roll_number}</span>
            </p>
          </div>
          <form action={studentLogout}>
            <button className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-surface">
              Sign out
            </button>
          </form>
        </header>

        <div className="mt-8 rounded-lg border border-dashed border-border bg-white p-10 text-center">
          <p className="text-sm text-slate">
            Phase 0 complete. Your exam timetable and dynamic pass land in
            Phase 2.
          </p>
        </div>
      </div>
    </main>
  );
}
