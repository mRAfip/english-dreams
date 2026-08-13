import { getR2Config } from "./client";
import { presignUrl, type PresignParams } from "./sign";

// R2 presign helpers. The browser uploads/downloads directly to R2 with these
// time-limited URLs, so large videos never stream through the Next server.

const UPLOAD_TTL = 60 * 15; // 15 min — enough for a large video over a slow link
const DOWNLOAD_TTL = 60 * 60; // 1 hour

function sign(
  method: PresignParams["method"],
  key: string,
  expiresIn: number,
  extraQuery?: Record<string, string>,
): string {
  const cfg = getR2Config();
  return presignUrl({
    method,
    endpoint: cfg.endpoint,
    bucket: cfg.bucket,
    key,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    region: cfg.region,
    expiresIn,
    extraQuery,
  });
}

/** A presigned PUT URL. The browser uploads the file body straight to R2. */
export function getUploadUrl(key: string): string {
  return sign("PUT", key, UPLOAD_TTL);
}

/** The filename shown when a download is saved — the last path segment. */
function basename(key: string): string {
  const seg = key.split("/").pop() ?? "download";
  // Strip our uuid- prefix so the saved file reads as the original name.
  return seg.replace(/^[0-9a-f-]{36}-/i, "");
}

/**
 * A URL that serves the object. Prefers the public base URL (a CDN/custom
 * domain) when configured; otherwise a presigned GET so a private bucket works
 * out of the box.
 *
 * `disposition` controls how the browser handles it: "inline" (default) opens
 * PDFs/images in a new tab for viewing; "attachment" forces a save with the
 * original filename.
 */
export function getDownloadUrl(
  key: string,
  disposition: "inline" | "attachment" = "inline",
): string {
  const cfg = getR2Config();

  if (cfg.publicBaseUrl) {
    const base = `${cfg.publicBaseUrl}/${key
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    if (disposition === "attachment") {
      const cd = `attachment; filename="${basename(key)}"`;
      return `${base}?response-content-disposition=${encodeURIComponent(cd)}`;
    }
    return base;
  }

  const cd =
    disposition === "attachment"
      ? `attachment; filename="${basename(key)}"`
      : "inline";
  return sign("GET", key, DOWNLOAD_TTL, {
    "response-content-disposition": cd,
  });
}

/**
 * A browser-viewable URL for a document. Browsers do not render Microsoft
 * Office files themselves, so an inline response still triggers a download.
 * Send those files through Office's web viewer; PDFs and other browser-native
 * formats can use the R2 inline URL directly.
 */
export function getDocumentViewUrl(key: string, fileName?: string | null): string {
  const inlineUrl = getDownloadUrl(key, "inline");
  const extension = (fileName ?? basename(key)).split(".").pop()?.toLowerCase();

  if (["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(extension ?? "")) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(inlineUrl)}`;
  }

  return inlineUrl;
}

/** Delete an object from R2. Treats 404 as success (already gone). */
export async function deleteObject(key: string): Promise<void> {
  const res = await fetch(sign("DELETE", key, 60), { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed (${res.status}) for ${key}`);
  }
}
