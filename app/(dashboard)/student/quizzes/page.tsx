import { loadJourney } from "@/lib/student/journey";
import { QuizBoard } from "@/components/student/quiz-board";

// Student > Quizzes — the weekend papers: what can be sat now, what has been
// marked, and what is still ahead. Sitting one takes over the page.
export default async function Page() {
  return <QuizBoard journey={await loadJourney()} />;
}
