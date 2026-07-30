import { createHash, createHmac } from "node:crypto";

// AWS Signature Version 4 — query-string ("presigned URL") variant.
//
// R2 is S3-compatible, so the standard SigV4 presign works against it. We sign
// only the `host` header and mark the payload UNSIGNED, which lets the browser
// PUT/GET the object directly with any body and content-type. The signature is
// carried in the query string and expires after `expiresIn` seconds.
//
// Implemented by hand (node:crypto) rather than via @aws-sdk so there is no
// dependency to install — the algorithm is small and stable.

const ALGORITHM = "AWS4-HMAC-SHA256";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/** RFC 3986 encoding. AWS requires every reserved char escaped except unreserved. */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Encode an object key: encode each path segment but keep the `/` separators. */
function encodeKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/");
}

/** `20240131T145600Z` (amz-date) and `20240131` (date stamp) from an epoch ms. */
function amzDates(nowMs: number): { amzDate: string; dateStamp: string } {
  const iso = new Date(nowMs).toISOString(); // 2024-01-31T14:56:00.123Z
  const amzDate = iso.replace(/[:-]|\.\d{3}/g, ""); // 20240131T145600Z
  const dateStamp = amzDate.slice(0, 8); // 20240131
  return { amzDate, dateStamp };
}

function signingKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

export type PresignParams = {
  method: "GET" | "PUT" | "DELETE";
  /** Full origin, e.g. https://<account>.r2.cloudflarestorage.com */
  endpoint: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /** Link lifetime in seconds. */
  expiresIn: number;
  /**
   * Extra query params to sign, e.g. S3 response-header overrides
   * (`response-content-disposition`, `response-content-type`). Folded into the
   * canonical query so they're covered by the signature.
   */
  extraQuery?: Record<string, string>;
  /** Epoch ms the signature is anchored to. Defaults to Date.now(). */
  nowMs?: number;
};

/**
 * Build a presigned S3 URL. Path-style: `<endpoint>/<bucket>/<key>`.
 * The returned URL can be used directly by the browser for the given method.
 */
export function presignUrl(params: PresignParams): string {
  const {
    method,
    endpoint,
    bucket,
    key,
    accessKeyId,
    secretAccessKey,
    region,
    expiresIn,
  } = params;

  const host = new URL(endpoint).host;
  const service = "s3";
  const { amzDate, dateStamp } = amzDates(params.nowMs ?? Date.now());

  const canonicalUri = `/${encodeRfc3986(bucket)}/${encodeKey(key)}`;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  // Query params must be sorted by key for the canonical request. Any extra
  // (response-header override) params are signed alongside the X-Amz-* ones.
  const query: Record<string, string> = {
    ...params.extraQuery,
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(query[k])}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    "host",
    UNSIGNED_PAYLOAD,
  ].join("\n");

  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac(
    "sha256",
    signingKey(secretAccessKey, dateStamp, region, service),
  )
    .update(stringToSign, "utf8")
    .digest("hex");

  return `${endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
