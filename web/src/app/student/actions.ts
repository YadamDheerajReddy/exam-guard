"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rollNumberToAuthEmail } from "@/lib/student-auth";

export type StudentLoginState = { error?: string } | undefined;

export async function studentLogin(
  _prevState: StudentLoginState,
  formData: FormData,
): Promise<StudentLoginState> {
  const rollNumber = String(formData.get("rollNumber") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!rollNumber || !password) {
    return { error: "Enter your roll number and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: rollNumberToAuthEmail(rollNumber),
    password,
  });

  if (error) {
    return { error: "Incorrect roll number or password." };
  }

  redirect("/student");
}

export async function studentLogout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/student/login");
}
