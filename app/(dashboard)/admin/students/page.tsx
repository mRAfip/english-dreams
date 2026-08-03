import { requireRole } from "@/lib/auth/guards";
import { getStudents } from "@/lib/student/directory";
import { getTrainers } from "@/lib/trainer/directory";
import { listCourseOptions } from "@/lib/content/queries";
import { StudentDirectory } from "@/components/admin/student-directory";

// Admin > Students — provision students (create account + assign the student
// role + a course + a trainer) and see the roster. Backed by the profiles,
// role-assignment, student_access and student_trainer_assignments tables.
//
// The course is what decides which curriculum a student sees, so it is chosen
// at creation alongside the trainer.
export default async function Page() {
  await requireRole("admin");
  const [students, trainers, courses] = await Promise.all([
    getStudents(),
    getTrainers(),
    listCourseOptions(),
  ]);
  return (
    <StudentDirectory
      students={students}
      trainers={trainers.map((t) => ({ id: t.id, name: t.name }))}
      courses={courses.map((c) => ({ id: c.id, title: c.title }))}
    />
  );
}
