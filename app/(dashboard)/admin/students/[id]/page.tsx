import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getStudent } from "@/lib/student/directory";
import { getTrainers } from "@/lib/trainer/directory";
import { listCourseOptions } from "@/lib/content/queries";
import { StudentDetail } from "@/components/admin/student-detail";

// Admin > Students > one student — profile summary plus edit/delete controls,
// including the course they follow. Backed by the profiles, role-assignment,
// student_access and student_trainer_assignments tables.
export default async function Page(
  props: PageProps<"/admin/students/[id]">,
) {
  await requireRole("admin");
  const { id } = await props.params;

  const [student, trainers, courses] = await Promise.all([
    getStudent(id),
    getTrainers(),
    listCourseOptions(),
  ]);
  if (!student) notFound();

  return (
    <StudentDetail
      student={student}
      trainers={trainers.map((t) => ({ id: t.id, name: t.name }))}
      courses={courses.map((c) => ({ id: c.id, title: c.title }))}
    />
  );
}
