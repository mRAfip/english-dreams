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
};

/** A student's stored result for a quiz, keyed by content_quizzes id. */
export type QuizAttempt = { score: number };

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
  currentWeek: number,
  attempt: QuizAttempt | undefined,
): StudentQuiz {
  const available = quiz.status === "published" && quiz.quizId !== null;
  const reached = weekNumber <= currentWeek;

  let state: QuizState;
  if (!available || !reached) {
    state = "locked";
  } else if (attempt) {
    state = "done";
  } else if (weekNumber < currentWeek) {
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

/**
 * Build a student's journey from their course's curriculum (the admin-authored
 * content tables). The course's shape — weeks, days, video/notes/task — is live
 * data; access is gated on publish status (unpublished days read as locked).
 *
 * Pass `course: null` with an empty curriculum for an unassigned student: every
 * count comes out zero and the screens show the "no course yet" state.
 */
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

  // Progression is sequential and completion-driven — it reads from the
  // student's own record (student_day_progress), NOT from how much content has
  // been published. A day is "done" only once the student has completed it; the
  // next day opens only then. Days past the one they're on stay locked, even if
  // their content is already published. Publishing is necessary to unlock a day,
  // but never sufficient on its own.
  const sortedDays = [...allDaysFlat].sort((a, b) => a.dayNumber - b.dayNumber);
  const isDone = (dayNumber: number): boolean =>
    progressFor(dayNumber).taskCompleted;
  const daysCompleted = sortedDays.filter((d) => isDone(d.dayNumber)).length;

  // The frontier: the first day, in order, the student hasn't completed.
  const frontier = sortedDays.find((d) => !isDone(d.dayNumber)) ?? null;
  // The day they can work on right now: the frontier, but only if its content
  // is released. If the next day isn't published yet, there is no open day —
  // the student is caught up and waiting for the next class.
  const activeDay = frontier && isReleased(frontier) ? frontier.dayNumber : 0;
  const anyReleased = sortedDays.some(isReleased);
  // What "Day X of Y" points at: the open day; else the day being waited on;
  // else the last day once the whole programme is done; else 0 (nothing yet).
  const currentDay = activeDay
    ? activeDay
    : frontier
      ? anyReleased
        ? frontier.dayNumber
        : 0
      : totalDays;
  const currentWeek = Math.min(
    Math.max(1, currentDay ? weekNumberForDay(currentDay) : 1),
    Math.max(1, totalWeeks),
  );

  const weeks: StudentWeek[] = curriculum.map((week) => {
    const days = week.days.map<StudentDay>((day) => {
      const state: DayState = isDone(day.dayNumber)
        ? "done"
        : day.dayNumber === activeDay
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
          // Real duration from the upload probe; fall back so the row still reads.
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

    return {
      weekNumber: week.weekNumber,
      title: week.title,
      focus: week.focus,
      days,
      quizzes: week.quizzes.map((q) =>
        mapStudentQuiz(
          q,
          week.weekNumber,
          currentWeek,
          q.quizId ? attemptsByQuiz.get(q.quizId) : undefined,
        ),
      ),
      state:
        week.weekNumber < currentWeek
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
