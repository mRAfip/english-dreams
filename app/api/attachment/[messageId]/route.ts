import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDownloadUrl } from "@/lib/r2/presign";

// Serves a message attachment from the private R2 bucket by redirecting to a
// fresh presigned GET. Access control IS the RLS: the message row is read with
// the viewer's own client, so `messages` msg_select only returns it when the
// viewer is a member of the conversation. `?download` forces a save.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data } = await supabase
    .from("messages")
    .select("attachment_key, deleted_at")
    .eq("id", messageId)
    .maybeSingle();

  const row = data as { attachment_key: string | null; deleted_at: string | null } | null;
  if (!row || !row.attachment_key || row.deleted_at) {
    return new NextResponse("Not found", { status: 404 });
  }

  const disposition = req.nextUrl.searchParams.has("download")
    ? "attachment"
    : "inline";

  return NextResponse.redirect(getDownloadUrl(row.attachment_key, disposition), {
    status: 302,
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
