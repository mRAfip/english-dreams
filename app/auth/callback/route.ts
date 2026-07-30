import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { homeFor, resolveRole } from "@/lib/auth/roles";

// Exchanges the OAuth code for a session, then redirects to `next` when one was
// requested, otherwise to the dashboard for the user's assigned role.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : null;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const role = await resolveRole(supabase, data.user.id);
  if (!role) {
    // Authenticated but unassigned — e.g. someone signed in with Google using
    // an address no admin has provisioned. Drop the session.
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=no_role`);
  }

  // A disabled student (payment pending) keeps their session but is routed to
  // the friendly /suspended screen rather than the dashboard.
  if (role === "student") {
    const { data: access } = await supabase
      .from("student_access")
      .select("access_enabled")
      .eq("student_id", data.user.id)
      .maybeSingle();
    if (access && access.access_enabled === false) {
      return NextResponse.redirect(`${origin}/suspended`);
    }
  }

  return NextResponse.redirect(`${origin}${safeNext ?? homeFor(role)}`);
}
