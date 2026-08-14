import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-ink">ExamGuard</h1>
        <p className="mt-2 text-sm text-slate">
          Smart exam allocation &amp; identity verification
        </p>

        <div className="mt-10 flex flex-col gap-4">
          <Link
            href="/admin/login"
            className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Admin Console
          </Link>
          <Link
            href="/student/login"
            className="rounded-lg border border-border bg-white px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface"
          >
            Student Portal
          </Link>
        </div>
      </div>
    </main>
  );
}
