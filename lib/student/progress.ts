import { weekNumberForDay } from "@/lib/content/curriculum";
import {
  TEACHING_DAYS_PER_WEEK,
  type Course,
  type CurriculumDay,
  type CurriculumWeek,
  type WeekendQuiz,
} from "@/types/content";

// One student's journey through THEIR COURSE — the model every student screen
// reads from. Home, learning path, quizzes and certificates all render slices
// of the same `StudentJourney`, so they cannot disagree about which day the
// student is on or what they scored.
//
// The journey is always scoped to one course (students are assigned exactly
// one). Its length is whatever that course has been authored to — there is no
// fixed 60 days any more, so `totalDays`/`totalWeeks` are the only denominators
// any screen should use. A student with no course assigned gets an empty
// journey with `course: null`, which the screens render as a waiting state.
//
// Note on content status: the admin ContentStatus ("draft"/"empty") is about
// authoring, not entitlement. A student's access is decided by how far they
// have travelled, so the student view ignores status entirely and gates on
// `dayNumber <= currentDay`.

/** Where a teaching day sits relative to today. */
export type DayState = "done" | "today" | "locked";

/** One student's recorded activity on a day. Missing row = all false. */
export type DayProgress = {
  videoWatched: boolean;
  notesDownloaded: boolean;
  taskCompleted: boolean;
  /** content_day_videos ids the student has played. */
  videoWatchedParts: string[];
  updatedAt?: string;
};

/** What has happened to the day's homework. */
export type TaskState =
  /** Released, nothing sent yet. */
  | "open"
  /** Sent, sitting in the trainer's review queue. */
  | "submitted"
  /** Trainer graded and approved it. */
  | "reviewed"
  /** Trainer sent it back for another attempt. */
  | "redo"
  /** The day closed without a submission. */
  | "missed";

export type StudentTask = {
  title: string;
  prompt: string;
  state: TaskState;
  /** 0-100. Null until a trainer grades it. */
  score: number | null;
  feedback: string;
  /** The trainer who wrote the feedback. Null while unreviewed. */
  reviewedBy: string | null;
};

/** One published video part as the student sees it. */
export type StudentVideoPart = {
  id: string;
  position: number;
  title: string;
  description: string | null;
  durationMin: number | null;
  watched: boolean;
};

export type StudentDay = {
  dayNumber: number;
  weekNumber: number;
  /** 1..5 — position within its week. */
  weekday: number;
  title: string;
  /** Day-level summary — watched is true once every part is played. */
  video: { title: string; durationMin: number; watched: boolean };
  /** The published video parts, in order. */
  videos: StudentVideoPart[];
  notes: { title: string; downloaded: boolean };
  task: StudentTask;
  state: DayState;
};

/** Where a weekend paper sits for this student. */
export type QuizState = "done" | "open" | "missed" | "locked";

export type StudentQuiz = {
  id: string;
  /** The content_quizzes row id, needed to sit/submit. Null if not created. */
  quizId: string | null;
  weekNumber: number;
  day: "saturday" | "sunday";
  title: string;
  kind: "practice" | "assessment";
  durationMinutes: number;
  questionCount: number;
  state: QuizState;
  /** Percentage. Null unless the paper was sat. */
  score: number | null;
  correctCount: number | null;
  total: number | null;
};

/** A student's stored result for a quiz, keyed by content_quizzes id. */
export type QuizAttempt = {
  score: number;
  correctCount?: number;
  total?: number;
};

export type StudentWeek = {
  weekNumber: number;
  title: string;
  focus: string;
  days: StudentDay[];
  quizzes: StudentQuiz[];
  state: "done" | "current" | "locked";
};

export type StudentJourney = {
  /** The course this journey belongs to. Null when the admin hasn't assigned one. */
  course: Course | null;
  /** The latest released teaching day. 0 when nothing is published yet. */
  currentDay: number;
  /** The uncompleted active day number, 0 if caught up */
  activeDay: number;
  /** Released teaching days behind the current one. */
  daysCompleted: number;
  currentWeek: number;
  streakDays: number;
  /** Teaching days in THIS COURSE as authored (from the content tables). */
  totalDays: number;
  /** Weeks in this course as authored. */
  totalWeeks: number;
  weeks: StudentWeek[];
  /** The trainer who reviews this student's work. */
  trainer: { name: string; role: string };
};

/**
 * The task as it stands for the student. Completion is now a real flag from
 * student_day_progress; the trainer review lifecycle (submitted → reviewed /
 * redo, scores, feedback) is a later feature, so those stay null for now.
 */
function buildTask(
  title: string,
  prompt: string,
  completed: boolean,
): StudentTask {
  return {
    title,
    prompt,
    state: completed ? "submitted" : "open",
    score: null,
    feedback: "",
    reviewedBy: null,
  };
}

/**
 * A weekend paper as it stands for this student. Access is gated on the admin
 * publishing it and the student reaching the week; a stored attempt makes it
 * "done"; an unsat published paper in a past week reads as "missed".
 */
function mapStudentQuiz(
  quiz: WeekendQuiz,
  weekNumber: number,
  isWeekUnlocked: boolean,
  attempt: QuizAttempt | undefined,
  day5Completed: boolean,
  satCompleted: boolean,
  isPastWeek: boolean,
): StudentQuiz {
  const available = quiz.status === "published" && quiz.quizId !== null;

  let state: QuizState;
  if (!available || !isWeekUnlocked) {
    state = "locked";
  } else if (quiz.day === "saturday" && !day5Completed) {
    state = "locked";
  } else if (quiz.day === "sunday" && (!day5Completed || !satCompleted)) {
    state = "locked";
  } else if (attempt) {
    state = "done";
  } else if (isPastWeek) {
    state = "missed";
  } else {
    state = "open";
  }

  return {
    id: quiz.id,
    quizId: quiz.quizId,
    weekNumber,
    day: quiz.day,
    title: quiz.title,
    kind: quiz.kind,
    durationMinutes: quiz.durationMinutes,
    questionCount: quiz.questionCount,
    state,
    score: attempt?.score ?? null,
    correctCount: attempt?.correctCount ?? null,
    total: attempt?.total ?? null,
  };
}

/** A teaching day is visible to students once any of its slots is published. */
function isReleased(day: CurriculumDay): boolean {
  return (
    day.video.status === "published" ||
    day.notes.status === "published" ||
    day.task.status === "published"
  );
}

/**
 * Build a student's journey from their course's curriculum (the admin-authored
 * content tables). The course's shape — weeks, days, video/notes/task — is live
 * data; access is gated on publish status (unpublished days read as locked).
 *
 * Pass `course: null` with an empty curriculum for an unassigned student: every
 * count comes out zero and the screens show the "no course yet" state.
 */
function calculateProgressStreak(progressByDay: Map<number, DayProgress>): number {
  const dates: string[] = [];
  for (const p of progressByDay.values()) {
    if (p.taskCompleted && p.updatedAt) {
      dates.push(p.updatedAt);
    }
  }

  if (dates.length === 0) return 0;

  // Helper to convert ISO string to YYYY-MM-DD in local system time
  const toLocalDateStr = (isoString: string): string => {
    const d = new Date(isoString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const date = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${date}`;
  };

  // Convert to local date strings and remove duplicates
  const uniqueDates = Array.from(new Set(dates.map(toLocalDateStr)))
    .sort((a, b) => b.localeCompare(a));

  if (uniqueDates.length === 0) return 0;

  // Get current date string and yesterday date string in local timezone
  const todayStr = toLocalDateStr(new Date().toISOString());
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateStr(yesterday.toISOString());

  const latestDate = uniqueDates[0];

  // If the latest completed task was not today and not yesterday, streak is broken
  if (latestDate !== todayStr && latestDate !== yesterdayStr) {
    return 0;
  }

  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  let streak = 0;
  let currentDate = parseLocalDate(latestDate);

  for (const dateStr of uniqueDates) {
    const d = parseLocalDate(dateStr);
    const diffTime = Math.abs(currentDate.getTime() - d.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      streak = 1;
    } else if (diffDays === 1) {
      streak += 1;
      currentDate = d;
    } else {
      break;
    }
  }

  return streak;
}

export function buildJourney(
  course: Course | null,
  curriculum: CurriculumWeek[],
  progressByDay: Map<number, DayProgress> = new Map(),
  attemptsByQuiz: Map<string, QuizAttempt> = new Map(),
): StudentJourney {
  const allDaysFlat = curriculum.flatMap((w) => w.days);
  const totalDays = allDaysFlat.length;
  const totalWeeks = curriculum.length;

  const progressFor = (dayNumber: number): DayProgress =>
    progressByDay.get(dayNumber) ?? {
      videoWatched: false,
      notesDownloaded: false,
      taskCompleted: false,
      videoWatchedParts: [],
    };

  const sortedDays = [...allDaysFlat].sort((a, b) => a.dayNumber - b.dayNumber);
  const isDone = (dayNumber: number): boolean =>
    progressFor(dayNumber).taskCompleted;
  const daysCompleted = sortedDays.filter((d) => isDone(d.dayNumber)).length;

  // Determine which weeks are fully completed and which are unlocked
  // Week W is unlocked if Week W-1 is fully completed (5 teaching days + quizzes done)
  const unlockedWeekNumbers = new Set<number>();

  for (let i = 0; i < curriculum.length; i++) {
    const w = curriculum[i];
    const weekNum = w.weekNumber;

    if (i === 0) {
      // Week 1 is always unlocked
      unlockedWeekNumbers.add(weekNum);
    } else {
      const prevWeek = curriculum[i - 1];
      const prevWeekDaysDone =
        prevWeek.days.length === 0 ||
        prevWeek.days.every((d) => isDone(d.dayNumber));

      const satQ = prevWeek.quizzes.find((q) => q.day === "saturday");
      const sunQ = prevWeek.quizzes.find((q) => q.day === "sunday");

      const satDone = !satQ || !satQ.quizId || satQ.status !== "published" || attemptsByQuiz.has(satQ.quizId);
      const sunDone = !sunQ || !sunQ.quizId || sunQ.status !== "published" || attemptsByQuiz.has(sunQ.quizId);

      const prevWeekFullyDone = prevWeekDaysDone && satDone && sunDone;

      if (unlockedWeekNumbers.has(prevWeek.weekNumber) && prevWeekFullyDone) {
        unlockedWeekNumbers.add(weekNum);
      }
    }
  }

  // Active day: first uncompleted day in the unlocked weeks
  const frontier =
    sortedDays.find(
      (d) => !isDone(d.dayNumber) && unlockedWeekNumbers.has(weekNumberForDay(d.dayNumber)),
    ) ?? null;
  const activeDay = frontier && isReleased(frontier) ? frontier.dayNumber : 0;
  const anyReleased = sortedDays.some(isReleased);

  const currentDay = activeDay
    ? activeDay
    : frontier
      ? anyReleased
        ? frontier.dayNumber
        : 0
      : totalDays;

  // Determine current active week (the lowest unlocked week that is not fully completed)
  let currentWeek = 1;
  for (const w of curriculum) {
    if (unlockedWeekNumbers.has(w.weekNumber)) {
      currentWeek = w.weekNumber;
      const daysDone =
        w.days.length === 0 || w.days.every((d) => isDone(d.dayNumber));
      const satQ = w.quizzes.find((q) => q.day === "saturday");
      const sunQ = w.quizzes.find((q) => q.day === "sunday");
      const satDone = !satQ || !satQ.quizId || satQ.status !== "published" || attemptsByQuiz.has(satQ.quizId);
      const sunDone = !sunQ || !sunQ.quizId || sunQ.status !== "published" || attemptsByQuiz.has(sunQ.quizId);
      if (!daysDone || !satDone || !sunDone) {
        break;
      }
    }
  }
  currentWeek = Math.min(Math.max(1, currentWeek), Math.max(1, totalWeeks));

  const weeks: StudentWeek[] = curriculum.map((week) => {
    const isWeekUnlocked = unlockedWeekNumbers.has(week.weekNumber);
    const day5Completed =
      week.days.length === 0 || week.days.every((d) => isDone(d.dayNumber));

    const satQuiz = week.quizzes.find((q) => q.day === "saturday");
    const satCompleted = Boolean(
      satQuiz && satQuiz.quizId && attemptsByQuiz.has(satQuiz.quizId),
    );

    const sunQuiz = week.quizzes.find((q) => q.day === "sunday");
    const sunCompleted = Boolean(
      sunQuiz && sunQuiz.quizId && attemptsByQuiz.has(sunQuiz.quizId),
    );

    const weekFullyDone = day5Completed &&
      (!satQuiz || !satQuiz.quizId || satQuiz.status !== "published" || satCompleted) &&
      (!sunQuiz || !sunQuiz.quizId || sunQuiz.status !== "published" || sunCompleted);

    const days = week.days.map<StudentDay>((day) => {
      const state: DayState = isDone(day.dayNumber)
        ? "done"
        : isWeekUnlocked && day.dayNumber === activeDay
          ? "today"
          : "locked";
      const progress = progressFor(day.dayNumber);
      const watchedPartIds = new Set(progress.videoWatchedParts);
      const videos = day.videos
        .filter((p) => p.status === "published")
        .map((p) => ({
          id: p.id,
          position: p.position,
          title: p.title || `Part ${p.position}`,
          description: p.description,
          durationMin: p.durationMin,
          watched: watchedPartIds.has(p.id),
        }));

      return {
        dayNumber: day.dayNumber,
        weekNumber: week.weekNumber,
        weekday: day.weekday,
        title: day.title,
        video: {
          title: day.video.title,
          durationMin: day.video.durationMin ?? 18 + ((day.dayNumber * 7) % 25),
          watched: progress.videoWatched,
        },
        videos,
        notes: {
          title: day.notes.title,
          downloaded: progress.notesDownloaded,
        },
        task: buildTask(
          day.task.title,
          day.task.prompt ||
            "Record a 2-minute answer using today's structures, then send it to your trainer.",
          progress.taskCompleted,
        ),
        state,
      };
    });

    const isPastWeek = week.weekNumber < currentWeek;

    return {
      weekNumber: week.weekNumber,
      title: week.title,
      focus: week.focus,
      days,
      quizzes: week.quizzes.map((q) =>
        mapStudentQuiz(
          q,
          week.weekNumber,
          isWeekUnlocked,
          q.quizId ? attemptsByQuiz.get(q.quizId) : undefined,
          day5Completed,
          satCompleted,
          isPastWeek,
        ),
      ),
      state: weekFullyDone
        ? "done"
        : week.weekNumber === currentWeek
          ? "current"
          : "locked",
    };
  });

  const streakDays = calculateProgressStreak(progressByDay);

  return {
    course,
    currentDay,
    activeDay,
    daysCompleted,
    currentWeek,
    streakDays,
    totalDays,
    totalWeeks,
    weeks,
    trainer: { name: "Rafi", role: "Your trainer" },
  };
}

/** Every teaching day, flattened — for lookups that don't care about weeks. */
export function allDays(journey: StudentJourney): StudentDay[] {
  return journey.weeks.flatMap((w) => w.days);
}

/** Every weekend paper, flattened. */
export function allQuizzes(journey: StudentJourney): StudentQuiz[] {
  return journey.weeks.flatMap((w) => w.quizzes);
}

/** The day unlocked today — the hero of the home screen. */
export function today(journey: StudentJourney): StudentDay | null {
  return allDays(journey).find((d) => d.state === "today") ?? null;
}

/** Progress through the course, as a percentage of its authored days. */
export function progressPercent(journey: StudentJourney): number {
  return journey.totalDays === 0
    ? 0
    : Math.round((journey.daysCompleted / journey.totalDays) * 100);
}

/** Mean score across sat weekend papers. Null before the first one. */
export function quizAverage(journey: StudentJourney): number | null {
  const scored = allQuizzes(journey).filter((q) => q.score !== null);
  if (scored.length === 0) return null;
  return Math.round(
    scored.reduce((sum, q) => sum + (q.score ?? 0), 0) / scored.length,
  );
}

/** Mean score across graded tasks. Null before the first one is reviewed. */
export function taskAverage(journey: StudentJourney): number | null {
  const scored = allDays(journey).filter((d) => d.task.score !== null);
  if (scored.length === 0) return null;
  return Math.round(
    scored.reduce((sum, d) => sum + (d.task.score ?? 0), 0) / scored.length,
  );
}

/** Days whose task is waiting on a trainer. */
export function awaitingReview(journey: StudentJourney): StudentDay[] {
  return allDays(journey).filter((d) => d.task.state === "submitted");
}

/** Days sent back for another attempt — the student's most urgent work. */
export function needsRedo(journey: StudentJourney): StudentDay[] {
  return allDays(journey).filter((d) => d.task.state === "redo");
}

/** Most recently graded work first — the feedback rail on the home screen. */
export function recentFeedback(journey: StudentJourney, limit: number): StudentDay[] {
  return allDays(journey)
    .filter((d) => d.task.feedback !== "")
    .sort((a, b) => b.dayNumber - a.dayNumber)
    .slice(0, limit);
}

/** Papers the student can sit right now. */
export function openQuizzes(journey: StudentJourney): StudentQuiz[] {
  return allQuizzes(journey).filter((q) => q.state === "open");
}

export { TEACHING_DAYS_PER_WEEK };
