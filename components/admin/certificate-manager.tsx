"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  Download,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DirectoryFilters,
  DirectoryToolbar,
  SearchField,
  TAB_PANEL_CLASS,
} from "@/components/admin/directory-toolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  requestCertificateUploadUrl,
  issueCertificate,
  revokeCertificate,
} from "@/lib/certificate/actions";
import type { CertificateStudent } from "@/types/certificate";

// Admin > Certificates — students grouped by how close they are to graduating,
// and the certificate that has (or hasn't) gone out. Files upload straight to
// Cloudflare R2 via a presigned PUT; the object key is recorded on the
// certificate row. Renders inside the (dashboard) shell.

type Mode = "ready" | "nearing" | "issued";

export function CertificateManager({
  students,
  r2Configured,
}: {
  students: CertificateStudent[];
  r2Configured: boolean;
}) {
  const [query, setQuery] = React.useState("");

  const term = query.trim().toLowerCase();
  const matches = (s: CertificateStudent) =>
    !term ||
    s.name.toLowerCase().includes(term) ||
    s.email.toLowerCase().includes(term);

  const filtered = students.filter(matches);
  const ready = filtered.filter((s) => s.status === "ready");
  const nearing = filtered.filter((s) => s.status === "nearing");
  const issued = filtered.filter((s) => s.status === "issued");
  const readyCount = students.filter((s) => s.status === "ready").length;
  const issuedCount = students.filter((s) => s.status === "issued").length;

  return (
    <div>
      <header className="flex flex-col gap-1.5 border-b border-border pb-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Certificates
        </h1>
        <p className="text-sm text-body">
          {readyCount} ready to issue · {issuedCount} issued
        </p>
      </header>

      {!r2Configured ? (
        <p className="mt-6 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-deep">
          File storage (Cloudflare R2) isn&apos;t configured, so uploads and
          downloads are disabled. Set the R2 environment variables to enable them.
        </p>
      ) : null}

      <Tabs defaultValue="ready" className="mt-6">
        <DirectoryToolbar>
          <TabsList>
            <TabsTrigger value="ready">Ready to issue</TabsTrigger>
            <TabsTrigger value="nearing">Nearing completion</TabsTrigger>
            <TabsTrigger value="issued">Issued</TabsTrigger>
          </TabsList>

          <DirectoryFilters>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search students"
              label="Search students"
            />
          </DirectoryFilters>
        </DirectoryToolbar>

        <TabsContent value="ready" className={TAB_PANEL_CLASS}>
          <StudentTable
            students={ready}
            mode="ready"
            r2Configured={r2Configured}
            empty="No students have finished all 60 days yet."
          />
        </TabsContent>
        <TabsContent value="nearing" className={TAB_PANEL_CLASS}>
          <StudentTable
            students={nearing}
            mode="nearing"
            r2Configured={r2Configured}
            empty="Nobody is in the final stretch right now."
          />
        </TabsContent>
        <TabsContent value="issued" className={TAB_PANEL_CLASS}>
          <StudentTable
            students={issued}
            mode="issued"
            r2Configured={r2Configured}
            empty="No certificates have gone out yet."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StudentTable({
  students,
  mode,
  r2Configured,
  empty,
}: {
  students: CertificateStudent[];
  mode: Mode;
  r2Configured: boolean;
  empty: string;
}) {
  if (students.length === 0) {
    return <TableEmpty icon={Award} message={empty} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Student</TableHead>
          <TableHead className="hidden sm:table-cell">Progress</TableHead>
          <TableHead className="hidden lg:table-cell">Score</TableHead>
          <TableHead className="hidden md:table-cell">
            {mode === "issued" ? "Issued" : "Status"}
          </TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar>
                  {s.avatarUrl && <AvatarImage src={s.avatarUrl} alt="" />}
                  <AvatarFallback>{initials(s.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-ink">{s.name}</div>
                  <div className="text-xs text-mute">{s.email}</div>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden whitespace-nowrap text-body sm:table-cell tabular-nums">
              {s.daysCompleted}/{s.totalDays} days
            </TableCell>
            <TableCell className="hidden lg:table-cell tabular-nums">
              {s.finalScore === null ? "—" : `${s.finalScore}%`}
            </TableCell>
            <TableCell className="hidden whitespace-nowrap md:table-cell">
              {mode === "issued" && s.certificate ? (
                <span className="text-mute">{s.certificate.issuedAt}</span>
              ) : mode === "ready" ? (
                <span className="text-mute">
                  {s.completedAt ?? "Completed"}
                </span>
              ) : (
                <span className="text-mute">
                  {s.totalDays - s.daysCompleted} days left
                </span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <RowActions student={s} mode={mode} r2Configured={r2Configured} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RowActions({
  student,
  mode,
  r2Configured,
}: {
  student: CertificateStudent;
  mode: Mode;
  r2Configured: boolean;
}) {
  if (mode === "nearing") {
    return <span className="text-xs text-mute">Not finished</span>;
  }

  if (mode === "issued") {
    return (
      <div className="flex items-center justify-end gap-1">
        {student.certificate?.downloadUrl ? (
          <Button variant="ghost" size="sm" asChild>
            <a href={student.certificate.downloadUrl} download>
              <Download />
              Download
            </a>
          </Button>
        ) : null}
        <CertificateUploadButton
          student={student}
          label="Replace"
          disabled={!r2Configured}
        />
        <RevokeButton student={student} />
      </div>
    );
  }

  // ready
  return (
    <CertificateUploadButton
      student={student}
      label="Upload"
      variant="tertiary"
      disabled={!r2Configured}
    />
  );
}

/** Direct-to-R2 certificate upload: presign PUT → PUT bytes → record the row. */
function CertificateUploadButton({
  student,
  label,
  variant = "ghost",
  disabled,
}: {
  student: CertificateStudent;
  label: string;
  variant?: "ghost" | "tertiary";
  disabled?: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      const { key, uploadUrl } = await requestCertificateUploadUrl({
        studentId: student.id,
        fileName: file.name,
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: file.type ? { "Content-Type": file.type } : undefined,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);

      const result = await issueCertificate({
        studentId: student.id,
        key,
        fileName: file.name,
        contentType: file.type || null,
        sizeBytes: file.size,
      });
      if (!result.ok) throw new Error(result.error);

      toast.success(`Certificate issued to ${student.name}`);
      router.refresh();
    } catch (err) {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="sr-only"
        onChange={handleFile}
        disabled={busy || disabled}
      />
      <Button
        type="button"
        variant={variant}
        size="sm"
        disabled={busy || disabled}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Upload />}
        {busy ? "Uploading…" : label}
      </Button>
    </>
  );
}

function RevokeButton({ student }: { student: CertificateStudent }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function handleRevoke() {
    setBusy(true);
    try {
      const result = await revokeCertificate({ studentId: student.id });
      if (!result.ok) throw new Error(result.error);
      toast.success(`Certificate removed for ${student.name}`);
      router.refresh();
    } catch (err) {
      toast.error("Couldn't remove certificate", {
        description: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleRevoke}
      disabled={busy}
      className="text-destructive hover:text-destructive"
      aria-label={`Remove ${student.name}'s certificate`}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
