import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student-context";
import { studentLogout } from "../actions";
import { Logo } from "@/components/logo";

export default async function ProtectedStudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const student = await getCurrentStudent();

  if (!student) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/student/login");
  }

  if (student.mustChangePassword) {
    redirect("/student/change-password");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Logo size={22} withWordmark={false} />
          <div>
            <p className="text-sm font-bold text-ink">{student.fullName}</p>
            <p className="text-xs font-mono text-slate">{student.rollNumber}</p>
          </div>
        </div>
        <form action={studentLogout}>
          <button className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-surface">
            Sign out
          </button>
        </form>
      </header>

      <main className="flex-1 bg-surface px-6 py-8">{children}</main>
    </div>
  );
}
