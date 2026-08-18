import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StudentContext = {
  id: string;
  rollNumber: string;
  fullName: string;
  organizationId: string;
  mustChangePassword: boolean;
};

// Resolves the signed-in user's students row, if any. Null covers both
// "not signed in" and "signed in but not a student" — callers that need
// to tell those apart already have the user from their own getUser() call.
export async function getCurrentStudent(): Promise<StudentContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("students")
    .select("id, roll_number, full_name, organization_id, must_change_password, organizations(is_suspended)")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;

  // A Super Admin can hold an org out of service (organizations page) —
  // treat its students as unauthenticated everywhere, same as "not a
  // student at all", so an already-open session gets cut off on its next
  // request too, not just at the next login attempt.
  const org = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  if (org?.is_suspended) return null;

  return {
    id: data.id,
    rollNumber: data.roll_number,
    fullName: data.full_name,
    organizationId: data.organization_id,
    mustChangePassword: data.must_change_password,
  };
}

// Server actions are untrusted entry points (any POST that carries a valid
// session can reach them, not just our own UI) — actions that use the
// service-role client bypass RLS entirely and must check authorization
// themselves.
export async function requireStudent(): Promise<StudentContext> {
  const student = await getCurrentStudent();
  if (!student) {
    throw new Error("Not authorized.");
  }
  return student;
}
