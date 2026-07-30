// Cloudflare R2 configuration — resolved from server-only env vars.
//
// R2 is S3-compatible; we talk to it via presigned URLs (see ./presign), so
// there is no long-lived SDK client — just the config those helpers need.

export type R2Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /** Public base URL for serving objects, or null to use presigned GETs. */
  publicBaseUrl: string | null;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in .env — see the Cloudflare R2 section.`,
    );
  }
  return value;
}

/**
 * Read the R2 config. Throws if a required var is missing, so upload/download
 * paths fail loudly with a clear message rather than producing a broken URL.
 * R2's region is always "auto".
 */
export function getR2Config(): R2Config {
  const accountId = required("R2_ACCOUNT_ID");
  const endpoint =
    process.env.R2_ENDPOINT?.replace(/\/$/, "") ||
    `https://${accountId}.r2.cloudflarestorage.com`;

  return {
    endpoint,
    bucket: required("R2_BUCKET"),
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    region: "auto",
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "") || null,
  };
}

/** True when every required R2 var is present — for feature-flagging the UI. */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_BUCKET &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
}

/**
 * Avatar uploads only need R2 credentials — the bucket stays private and images
 * are served through /api/avatar/<id>, which redirects to a fresh presigned GET
 * (so no public base URL is required).
 */
export function avatarUploadsEnabled(): boolean {
  return isR2Configured();
}
