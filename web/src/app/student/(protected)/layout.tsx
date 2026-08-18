import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student-context";
import { studentLogout } from "../actions";
import { Logo } from "@/components/logo";
import { LogOut } from "lucide-react";

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
      <header className="flex items-center justify-between gap-4 border-b border-border bg-white px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo size={22} withWordmark={false} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{student.fullName}</p>
            <p className="truncate text-xs font-mono text-slate">{student.rollNumber}</p>
          </div>
        </div>
        <form action={studentLogout} className="shrink-0">
          <button className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-surface">
            <LogOut className="size-4" strokeWidth={2} />
            Sign out
          </button>
        </form>
      </header>

      <main className="flex-1 bg-surface px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
