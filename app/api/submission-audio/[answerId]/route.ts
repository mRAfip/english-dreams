import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDownloadUrl } from "@/lib/r2/presign";

// Serves a submission's voice answer from the private R2 bucket by redirecting
// to a fresh presigned GET. Access control IS the RLS: the answer row is read
// with the viewer's own client, so submission_answers_select only returns it
// when the viewer can access that submission (the student, their trainer, admin).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ answerId: string }> },
) {
  const { answerId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data } = await supabase
    .from("submission_answers")
    .select("audio_key")
    .eq("id", answerId)
    .maybeSingle();

  const key = (data as { audio_key: string | null } | null)?.audio_key;
  if (!key) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(getDownloadUrl(key), {
    status: 302,
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
