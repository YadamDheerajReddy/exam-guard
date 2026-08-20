import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStudent } from "@/lib/student-context";
import { studentLogout } from "../actions";
import { Logo } from "@/components/logo";
import { LogOut, ShieldCheck } from "lucide-react";

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

  // org-logos is a private bucket with no storage.objects policies (same
  // pattern as the admin console header) — signing always goes through the
  // service-role client, never the student's own session.
  const service = createAdminClient();
  const { data: org } = await service
    .from("organizations")
    .select("logo_url")
    .eq("id", student.organizationId)
    .maybeSingle();

  let orgLogoUrl: string | null = null;
  if (org?.logo_url) {
    const { data: signed } = await service.storage.from("org-logos").createSignedUrl(org.logo_url, 300);
    orgLogoUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-white px-4 py-4 print:hidden sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {orgLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL
            <img src={orgLogoUrl} alt="" className="size-[22px] shrink-0 rounded object-contain" />
          ) : (
            <Logo size={22} withWordmark={false} />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{student.fullName}</p>
            <p className="truncate text-xs font-mono text-slate">{student.rollNumber}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/student/privacy"
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-surface"
          >
            <ShieldCheck className="size-4" strokeWidth={2} />
            <span className="hidden sm:inline">Privacy</span>
          </Link>
          <form action={studentLogout}>
            <button className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-surface">
              <LogOut className="size-4" strokeWidth={2} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 bg-surface px-4 py-6 print:p-0 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
