import { AssignedStudentsTable } from "@/components/trainer/assigned-students-table";
import { loadAssignedRoster } from "@/lib/trainer/assigned";

// Trainer > Assigned Students — roster with progress, weekly attendance and
// weekend-quiz average per student, from the student_trainer_assignments,
// student_day_progress and student_quiz_attempts tables.
export default async function Page() {
  const students = await loadAssignedRoster();
  return <AssignedStudentsTable students={students} />;
}
