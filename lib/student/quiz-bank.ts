import type { StudentQuiz } from "@/lib/student/progress";

// Questions for a weekend paper.
//
// SCAFFOLD: a small authored pool, sampled deterministically per quiz id, so a
// paper always shows the same questions to the same student without a database.
// Replace `quizQuestions` with a read of the quiz_questions table; the runner
// only depends on the `QuizQuestion` type.

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  /** Index into `options`. Never sent to the client in the real version — the
   *  answer is checked server-side; here it powers the scaffold's instant mark. */
  correctIndex: number;
  /** Shown after the paper is submitted, right or wrong. */
  explanation: string;
};

const POOL: Omit<QuizQuestion, "id">[] = [
  {
    prompt: "She ____ to the market every Sunday morning.",
    options: ["go", "goes", "going", "gone"],
    correctIndex: 1,
    explanation:
      "Third person singular in the present simple takes -s: he/she/it goes.",
  },
  {
    prompt: "Which sentence is in the past tense?",
    options: [
      "I am writing a letter.",
      "I write letters often.",
      "I wrote a letter yesterday.",
      "I will write a letter.",
    ],
    correctIndex: 2,
    explanation: "'Wrote' is the past form of 'write'; 'yesterday' confirms it.",
  },
  {
    prompt: "Choose the polite way to disagree.",
    options: [
      "You are wrong.",
      "I see your point, but I'm not sure I agree.",
      "That makes no sense.",
      "No.",
    ],
    correctIndex: 1,
    explanation:
      "Hedging — acknowledging the other view before your own — keeps disagreement polite.",
  },
  {
    prompt: "Pick the correct question form.",
    options: [
      "Where you did go?",
      "Where did you go?",
      "Where you went?",
      "Where go you?",
    ],
    correctIndex: 1,
    explanation:
      "Questions in the past simple use did + the base verb: 'Where did you go?'",
  },
  {
    prompt: "Which word has the stress on the SECOND syllable?",
    options: ["TAble", "PHOtograph", "phoTOgraphy", "HAPpy"],
    correctIndex: 2,
    explanation:
      "'photography' stresses -tog-. Adding a suffix often moves the stress.",
  },
  {
    prompt: "The report ____ by the whole team last week.",
    options: ["was written", "wrote", "is writing", "has wrote"],
    correctIndex: 0,
    explanation:
      "Passive voice in the past: was/were + past participle ('written').",
  },
  {
    prompt: "Which is the most formal way to open an email?",
    options: ["Hey!", "Yo", "Dear Ms Patel,", "Hi there buddy,"],
    correctIndex: 2,
    explanation: "'Dear + title + surname' is the standard formal opening.",
  },
  {
    prompt: "If it ____ tomorrow, we'll cancel the class.",
    options: ["will rain", "rains", "rained", "is raining"],
    correctIndex: 1,
    explanation:
      "First conditional: present simple in the if-clause, will in the main clause.",
  },
  {
    prompt: "Choose the correct comparative.",
    options: [
      "This test is more easy than the last one.",
      "This test is easier than the last one.",
      "This test is more easier than the last one.",
      "This test is easyer than the last one.",
    ],
    correctIndex: 1,
    explanation:
      "Two-syllable adjectives ending in -y take -ier: easy → easier.",
  },
  {
    prompt: "What does 'to touch base' mean?",
    options: [
      "To start an argument",
      "To make brief contact with someone",
      "To finish a project",
      "To travel somewhere",
    ],
    correctIndex: 1,
    explanation: "It means to check in briefly — common in workplace English.",
  },
  {
    prompt: "I've lived here ____ 2019.",
    options: ["since", "for", "from", "during"],
    correctIndex: 0,
    explanation: "'Since' takes a point in time; 'for' takes a length of time.",
  },
  {
    prompt: "Which sentence sounds most natural on the phone?",
    options: [
      "Repeat that.",
      "Sorry, could you say that again?",
      "What? I don't understand you.",
      "Speak louder now.",
    ],
    correctIndex: 1,
    explanation:
      "Softening a request with 'Sorry, could you…' is the natural, polite form.",
  },
];

/** FNV-1a — same deterministic hash the rest of the scaffold uses. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The paper's questions. Sampled from the pool by quiz id, so every student
 * sitting `w9-sun` sees the same set, and re-opening the paper doesn't reshuffle
 * it mid-attempt.
 */
export function quizQuestions(quiz: StudentQuiz): QuizQuestion[] {
  const offset = hash(quiz.id) % POOL.length;

  return Array.from({ length: Math.min(quiz.questionCount, POOL.length) }, (_, i) => {
    const source = POOL[(offset + i) % POOL.length];
    return { ...source, id: `${quiz.id}-q${i + 1}` };
  });
}

/** Marks out of 100 for a set of answers, rounded. */
export function markPaper(
  questions: QuizQuestion[],
  answers: (number | null)[],
): number {
  const correct = questions.filter((q, i) => answers[i] === q.correctIndex).length;
  return Math.round((correct / questions.length) * 100);
}

/** The pass mark for a graded assessment. Practice papers aren't gated. */
export const PASS_MARK = 60;

/** Seconds a student gets per question. Graded assessments run tighter. */
const SECONDS_PER_QUESTION = { practice: 60, assessment: 45 } as const;

/**
 * How long the paper is open once started, in seconds. Derived from the
 * question count so a longer paper gets proportionally more time; the runner
 * counts down from this and auto-submits at zero.
 */
export function quizDurationSec(quiz: StudentQuiz): number {
  return quiz.questionCount * SECONDS_PER_QUESTION[quiz.kind];
}
