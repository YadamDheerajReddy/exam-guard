import "server-only";
import { createClient } from "@supabase/supabase-js";

// Bypasses RLS entirely via the service_role key. Only for operations that
// genuinely need it — creating auth.users rows (roster upload), which the
// Auth Admin API requires regardless of RLS. The `server-only` import makes
// any accidental client-bundle import a build error rather than a leak.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
