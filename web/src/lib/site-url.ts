import "server-only";
import { headers } from "next/headers";

// Builds an absolute URL for links inside credential emails. Reads the
// request's own Host header (works on Vercel/behind any proxy) rather than
// requiring a hardcoded NEXT_PUBLIC_SITE_URL env var to stay in sync.
export async function absoluteUrl(path: string) {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}${path}`;
}
