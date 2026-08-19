import { ResetPasswordForm } from "./reset-password-form";

export default async function StudentResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <ResetPasswordForm token={token ?? null} />
    </main>
  );
}
