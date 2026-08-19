import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session on every request and gates the /admin and
// /student route groups behind an active session. Role-specific checks
// (is this user actually an admin? actually a student?) happen in each
// route's own server component by reading the admins/students table —
// proxy only confirms "is anyone logged in".
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // reset-password is the landing page for someone who's locked out and
  // has no session by definition — gating it behind one would make the
  // "forgot password" flow unreachable for the exact case it exists for.
  const publicAdminPaths = ["/admin/login", "/admin/reset-password"];
  const isAdminRoute = pathname.startsWith("/admin") && !publicAdminPaths.includes(pathname);
  const publicStudentPaths = ["/student/login", "/student/reset-password"];
  const isStudentRoute = pathname.startsWith("/student") && !publicStudentPaths.includes(pathname);

  if (!user && isAdminRoute) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (!user && isStudentRoute) {
    return NextResponse.redirect(new URL("/student/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/student/:path*"],
};
