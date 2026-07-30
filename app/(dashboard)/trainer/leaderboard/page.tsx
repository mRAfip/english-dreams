import { TrainerLeaderboard } from "@/components/trainer/trainer-leaderboard";
import { loadTrainerLeaderboard } from "@/lib/leaderboard/trainer-board";

// Trainer > Leaderboard — assigned students ranked against each other on the
// weekend quizzes, each row also carrying its cohort-wide standing. Built from
// the student_trainer_assignments + student_quiz_attempts tables.
export default async function Page() {
  const boards = await loadTrainerLeaderboard();
  return <TrainerLeaderboard boards={boards} />;
}
