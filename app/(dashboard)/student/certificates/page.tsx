import { requireRole } from "@/lib/auth/guards";
import { loadJourney } from "@/lib/student/journey";
import { getStudentCertificate } from "@/lib/certificate/directory";
import { CertificateView } from "@/components/student/certificate-card";
import { NoCourseAssigned } from "@/components/student/no-course";

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

  // Without a course there is nothing to complete, so the requirements list
  // would read "finish all 0 teaching days" — say what's actually going on.
  if (!journey.course) return <NoCourseAssigned title="No certificate yet" />;

  return (
    <CertificateView name={name} journey={journey} certificate={certificate} />
  );
}
