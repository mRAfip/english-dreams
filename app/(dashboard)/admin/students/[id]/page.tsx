import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getStudent } from "@/lib/student/directory";
import { getTrainers } from "@/lib/trainer/directory";
import { StudentDetail } from "@/components/admin/student-detail";

// Admin > Students > one student — profile summary plus edit/delete controls.
// Backed by the profiles, role-assignment and student_trainer_assignments tables.
export default async function Page(
  props: PageProps<"/admin/students/[id]">,
) {
  await requireRole("admin");
  const { id } = await props.params;

  const [student, trainers] = await Promise.all([
    getStudent(id),
    getTrainers(),
  ]);
  if (!student) notFound();

  return (
    <StudentDetail
      student={student}
      trainers={trainers.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
