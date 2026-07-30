import { requireRole } from "@/lib/auth/guards";
import { loadJourney } from "@/lib/student/journey";
import { getStudentCertificate } from "@/lib/certificate/directory";
import { CertificateView } from "@/components/student/certificate-card";

// Student > Certificates — the completion certificate, and exactly what is
// still standing between the student and it. Needs the user's full name,
// since that is what gets printed on the document. Once an admin issues the
// certificate, the same card serves the real download.
export default async function Page() {
  const user = await requireRole("student");
  const name = user.fullName ?? user.email;

  const [journey, certificate] = await Promise.all([
    loadJourney(),
    getStudentCertificate(user.id),
  ]);

  return (
    <CertificateView name={name} journey={journey} certificate={certificate} />
  );
}
