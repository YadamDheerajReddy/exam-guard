import { StudentLoginForm } from "./login-form";

export default async function StudentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;
  return <StudentLoginForm justReset={reset === "success"} />;
}
