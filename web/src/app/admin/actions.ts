"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminLoginState = { error?: string } | undefined;

export async function adminLogin(
  _prevState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Incorrect email or password." };
  }

  // Super Admins can hold an org out of service entirely (organizations
  // page) — block org-scoped admins here with a clear reason rather than
  // just bouncing them back to a login form where their (correct)
  // credentials will look like they're failing for no reason.
  const { data: admin } = await supabase
    .from("admins")
    .select("organization_id, organizations(is_suspended)")
    .eq("id", data.user.id)
    .maybeSingle();
  const org = Array.isArray(admin?.organizations) ? admin.organizations[0] : admin?.organizations;
  if (admin?.organization_id && org?.is_suspended) {
    await supabase.auth.signOut();
    return { error: "This organization has been suspended. Contact your platform administrator." };
  }

  redirect("/admin");
}

export async function adminLogout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
