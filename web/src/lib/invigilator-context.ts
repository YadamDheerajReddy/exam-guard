import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type InvigilatorContext = {
  id: string;
  fullName: string;
  assignedHallId: string | null;
};

export class UnauthorizedError extends Error {}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

// The Expo app can't share the web app's cookie-based session, so every
// invigilator API route authenticates via the bearer access token
// supabase-js already holds after the app's own sign-in, rather than the
// cookie-based createClient() used by admin/student Server Components.
export async function requireInvigilator(request: Request): Promise<InvigilatorContext> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new UnauthorizedError("Missing bearer token.");
  }

  const service = createAdminClient();
  const { data: userData, error: userError } = await service.auth.getUser(token);
  if (userError || !userData.user) {
    throw new UnauthorizedError("Invalid or expired session.");
  }

  const { data } = await service
    .from("invigilators")
    .select("id, full_name, assigned_hall_id, is_active")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!data || !data.is_active) {
    throw new UnauthorizedError("Not an active invigilator account.");
  }

  return { id: data.id, fullName: data.full_name, assignedHallId: data.assigned_hall_id };
}
