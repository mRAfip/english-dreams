// Certificates — issued once a student finishes the 60-day programme.

/** The issued document. Null on a graduate means "not issued yet". */
export type Certificate = {
  /** R2 object key once the upload lands. */
  fileKey: string;
  /** Original filename, shown in the table. */
  fileName: string;
  issuedAt: string;
};

/** A student who has reached Day 60 — the only people who can be certified. */
export type Graduate = {
  id: string;
  name: string;
  email: string;
  cohort: string;
  /** Display date, e.g. "16 Jul 2026". */
  completedAt: string;
  /** Days since completion — drives the "last week" filter. */
  completedDaysAgo: number;
  /** Final programme score as a percentage. */
  finalScore: number;
  certificate: Certificate | null;
};

/** Completions inside this window count as "last week". */
export const RECENT_COMPLETION_DAYS = 7;

// --- Live model (backed by Supabase + R2) ----------------------------------

/**
 * Where a student sits relative to certification:
 *   issued       — a certificate has been uploaded for them
 *   ready        — finished all teaching days, awaiting a certificate
 *   nearing      — in the final stretch (last week), not yet finished
 *   in_progress  — still working through the programme
 */
export type CertificateStatus = "issued" | "ready" | "nearing" | "in_progress";

/** An issued certificate, with a ready-to-use serving URL (null if R2 is off). */
export type IssuedCertificate = {
  fileKey: string;
  fileName: string;
  /** Display date, e.g. "16 Jul 2026". */
  issuedAt: string;
  /** Presigned/public download URL, resolved server-side. */
  downloadUrl: string | null;
};

/** A student as seen by the certificate manager. */
export type CertificateStudent = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  daysCompleted: number;
  totalDays: number;
  /** Mean assessment score as a percentage; null when they've sat none. */
  finalScore: number | null;
  status: CertificateStatus;
  /** Display date the student finished all days, or null if not finished. */
  completedAt: string | null;
  certificate: IssuedCertificate | null;
};

/** Within this many days of the end, a student counts as "nearing completion". */
export const NEARING_COMPLETION_DAYS = 5;
