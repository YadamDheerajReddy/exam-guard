import "server-only";
import { createClient } from "@/lib/supabase/server";

export type AdminContext = {
  id: string;
  fullName: string;
  email: string;
  role: "SUPER_ADMIN" | "EXAM_STAFF" | "AUDITOR";
  organizationId: string | null;
  mustChangePassword: boolean;
};

// Resolves the signed-in user's admins row, if any. Null covers both "not
// signed in" and "signed in but not an admin" — callers that need to tell
// those apart already have the user from their own getUser() call.
export async function getCurrentAdmin(): Promise<AdminContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("admins")
    .select("id, full_name, email, role, organization_id, must_change_password, organizations(is_suspended)")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;

  // A Super Admin can hold an org out of service (organizations page) —
  // treat its admins as unauthenticated everywhere, same as "not an admin
  // at all", so an already-open session gets cut off on its next request
  // too, not just at the next login attempt.
  const org = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  if (data.organization_id && org?.is_suspended) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    role: data.role as AdminContext["role"],
    organizationId: data.organization_id,
    mustChangePassword: data.must_change_password,
  };
}

// Server actions are untrusted entry points (any POST that carries a valid
// session can reach them, not just our own UI) — RLS covers most of the
// data layer, but actions that use the service-role client bypass RLS
// entirely and must check authorization themselves.
export async function requireSuperAdmin(): Promise<AdminContext> {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== "SUPER_ADMIN") {
    throw new Error("Not authorized.");
  }
  return admin;
}

export async function requireOrgAdmin(): Promise<AdminContext & { organizationId: string }> {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role === "SUPER_ADMIN" || !admin.organizationId) {
    throw new Error("Not authorized.");
  }
  return admin as AdminContext & { organizationId: string };
}
