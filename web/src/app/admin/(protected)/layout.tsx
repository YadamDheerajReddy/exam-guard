import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Just "is anyone signed in" — the role-specific check (Super Admin vs org
// admin) and the shell UI live in the (platform) and (org) layouts nested
// underneath, since they need genuinely different navigation, not a
// conditionally-rendered branch of the same one.
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

  return children;
}
