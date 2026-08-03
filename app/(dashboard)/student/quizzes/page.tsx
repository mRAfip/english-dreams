import { loadJourney } from "@/lib/student/journey";
import { QuizBoard } from "@/components/student/quiz-board";
import { NoCourseAssigned } from "@/components/student/no-course";

// Student > Quizzes — their course's weekend papers: what can be sat now, what
// has been marked, and what is still ahead. Sitting one takes over the page.
export default async function Page() {
  const journey = await loadJourney();
  if (!journey.course) {
    return <NoCourseAssigned title="No quizzes yet" />;
  }
  return <QuizBoard journey={journey} />;
}
