import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDownloadUrl } from "@/lib/r2/presign";

// Serves a task review comment attachment from private R2 bucket by redirecting to a
// fresh presigned GET. Access control uses Supabase RLS on task_review_comments.
// `?download` forces an attachment disposition for save.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data } = await supabase
    .from("task_review_comments")
    .select("attachment_key")
    .eq("id", commentId)
    .maybeSingle();

  const row = data as { attachment_key: string | null } | null;
  if (!row || !row.attachment_key) {
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
