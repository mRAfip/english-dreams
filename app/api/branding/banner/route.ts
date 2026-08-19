import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDownloadUrl } from "@/lib/r2/presign";

// Serves the active branding banner from R2 by redirecting to a fresh presigned GET.
// The URL stored in Supabase is stable (e.g., /api/branding/banner?v=<ts>) while
// the underlying R2 link remains private and time-limited.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { data } = await supabase
    .from("branding")
    .select("banner_key")
    .maybeSingle();

  const key = (data as { banner_key: string | null } | null)?.banner_key;
  if (!key) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.redirect(getDownloadUrl(key), {
    status: 302,
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
