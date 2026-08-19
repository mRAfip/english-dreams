import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { getCourseBySlug, getDay } from "@/lib/content/queries";
import { getDownloadUrl } from "@/lib/r2/presign";
import { createClient } from "@/lib/supabase/server";

const OFFICE_EXTENSIONS = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx"]);

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function extension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function contentDisposition(fileName: string, download: boolean): string {
  const fallback = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Serve course notes with deterministic browser behavior. View responses are
 * inline with a corrected MIME type; only `?download` uses attachment.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string; dayNumber: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { courseSlug, dayNumber } = await params;
  const parsedDay = Number(dayNumber);
  if (!Number.isInteger(parsedDay) || parsedDay < 1) {
    return new NextResponse("Not found", { status: 404 });
  }

  const course = await getCourseBySlug(courseSlug);
  if (!course) return new NextResponse("Not found", { status: 404 });

  if (user.role === "student") {
    const supabase = await createClient();
    const { data: access } = await supabase
      .from("student_access")
      .select("course_id, access_enabled")
      .eq("student_id", user.id)
      .maybeSingle();
    if (!access?.access_enabled || access.course_id !== course.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  } else if (user.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const found = await getDay(course.id, parsedDay);
  const notes = found?.day.notes;
  if (!notes?.assetKey) return new NextResponse("Not found", { status: 404 });
  if (user.role === "student" && notes.status !== "published") {
    return new NextResponse("Not found", { status: 404 });
  }

  const fileName = notes.fileName ?? notes.assetKey.split("/").pop() ?? "notes";
  const ext = extension(fileName);
  const download = req.nextUrl.searchParams.has("download");
  const sourceUrl = getDownloadUrl(
    notes.assetKey,
    download ? "attachment" : "inline",
  );

  // Office documents need a document renderer because browsers cannot display
  // them natively. Use Google Docs embedded viewer for a responsive, mobile-friendly layout.
  if (!download && OFFICE_EXTENSIONS.has(ext)) {
    const viewer = `https://docs.google.com/gview?url=${encodeURIComponent(sourceUrl)}&embedded=true`;
    return NextResponse.redirect(viewer, { status: 302 });
  }

  const range = req.headers.get("range");
  const upstream = await fetch(sourceUrl, {
    headers: range ? { Range: range } : undefined,
    cache: "no-store",
  });
  if (!upstream.ok && upstream.status !== 206) {
    return new NextResponse("Unable to load notes", { status: 502 });
  }

  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Disposition": contentDisposition(fileName, download),
    "Content-Type": CONTENT_TYPES[ext] ?? upstream.headers.get("content-type") ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["accept-ranges", "content-length", "content-range"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
