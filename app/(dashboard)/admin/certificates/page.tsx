import { requireRole } from "@/lib/auth/guards";
import { getCertificateStudents } from "@/lib/certificate/directory";
import { isR2Configured } from "@/lib/r2/client";
import { CertificateManager } from "@/components/admin/certificate-manager";

// Admin > Certificates — course completion + certificate distribution. Students
// are grouped by how close they are to graduating; certificates upload to R2.
export default async function Page() {
  await requireRole("admin");
  const students = await getCertificateStudents();
  return (
    <CertificateManager students={students} r2Configured={isR2Configured()} />
  );
}
