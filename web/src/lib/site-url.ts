import "server-only";
import { headers } from "next/headers";

const PRODUCTION_ORIGIN = "https://app.examguard.online";

// Builds an absolute URL for links inside credential emails. Local dev
// still resolves off the request's own Host header (so links work at
// whatever port you're running on); everywhere else resolves to the fixed
// production domain rather than trusting the deployment's Host header —
// a Vercel preview URL or a proxy header shouldn't ever end up baked into
// an email a real admin/student receives.
export async function absoluteUrl(path: string) {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    return `http://${host}${path}`;
  }
  return `${PRODUCTION_ORIGIN}${path}`;
}
