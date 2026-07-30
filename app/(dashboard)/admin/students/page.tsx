import { requireRole } from "@/lib/auth/guards";
import { getStudents } from "@/lib/student/directory";
import { getTrainers } from "@/lib/trainer/directory";
import { StudentDirectory } from "@/components/admin/student-directory";

// Admin > Students — provision students (create account + assign the student
// role + a trainer) and see the roster. Backed by the profiles, role-assignment
// and student_trainer_assignments tables.
export default async function Page() {
  await requireRole("admin");
  const [students, trainers] = await Promise.all([getStudents(), getTrainers()]);
  return (
    <StudentDirectory
      students={students}
      trainers={trainers.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
