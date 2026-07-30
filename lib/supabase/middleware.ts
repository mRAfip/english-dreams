import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { homeFor, resolveRole } from "@/lib/auth/roles";

// Routes that require an authenticated session.
const PROTECTED_PREFIXES = [
  "/admin",
  "/trainer",
  "/student",
  "/inbox",
  "/profile",
  "/suspended",
];

/**
 * Refresh the Supabase session cookie and enforce coarse route protection.
 * Invoked from the root proxy on every matched request.
 *
 * Deliberately coarse: this only answers "signed in or not". Which role may
 * see which section is enforced by requireRole() in the section layouts, so we
 * don't pay for a role lookup on every single request.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

  // IMPORTANT: getUser() revalidates the token with Supabase; do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  // Not signed in and hitting a protected route -> send to /login.
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Already signed in and visiting /login -> send to the role's dashboard.
  // A user with no role assignment stays on /login and sees the error there,
  // otherwise this would bounce forever.
  if (user && pathname === "/login") {
    const role = await resolveRole(supabase, user.id);
    if (role) {
      const url = request.nextUrl.clone();
      url.pathname = homeFor(role);
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
