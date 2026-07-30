import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDownloadUrl } from "@/lib/r2/presign";

// Serves a user's avatar from the private R2 bucket by redirecting to a fresh
// presigned GET. Stored profile.avatar_url points here (e.g.
// /api/avatar/<id>?v=<ts>), so the URL in the DB is stable while the underlying
// R2 link is always current. Requires a signed-in viewer; the object key is read
// with the service role because profiles RLS hides other users' rows (avatars
// must be visible to everyone the viewer shares the app with — messages, lists).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("avatar_key")
    .eq("id", userId)
    .maybeSingle();

  const key = (data as { avatar_key: string | null } | null)?.avatar_key;
  if (!key) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(getDownloadUrl(key), {
    status: 302,
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
