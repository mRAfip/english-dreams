import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/auth/roles";

// Login access-check for the signed-in user. Called by the login form right
// after authentication to decide whether a student may proceed.
//
// Status codes:
//   200 — allowed (not a student, or a student whose access is enabled)
//   401 — no session
//   402 — Payment Required: the student's account is disabled (fee pending)
//
// The 402 body is student-facing copy — it never says "payment required"
// outright — so the client can show it or route to /suspended.
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  const role = await resolveRole(supabase, user.id);
  if (role !== "student") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // A missing row means access is enabled (the table is opt-in for older
  // accounts); new students always have a row from createStudent.
  const { data } = await supabase
    .from("student_access")
    .select("access_enabled")
    .eq("student_id", user.id)
    .maybeSingle();
  const enabled = (data as { access_enabled: boolean } | null)?.access_enabled ?? true;

  if (!enabled) {
    return NextResponse.json(
      {
        ok: false,
        code: "account_disabled",
        message:
          "We haven't received your latest payment yet, so your account is temporarily disabled. Please contact the English Dreams support team.",
      },
      { status: 402 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
