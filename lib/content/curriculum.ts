import {
  QUIZZES_PER_WEEK,
  TEACHING_DAYS_PER_WEEK,
  WEEKS_IN_PROGRAMME,
  type ContentStatus,
  type CurriculumDay,
  type CurriculumWeek,
  type WeekendQuiz,
} from "@/types/content";

// Scaffold curriculum — an in-memory stand-in for the real content tables.
// Everything here is generated, not authored: it exists so the admin screen has
// the right shape to render. Replace `buildCurriculum` with a Supabase query
// once the content schema lands; the component only depends on the types.

/** Week themes. One per week, in order — the spine of the programme. */
const WEEK_THEMES: { title: string; focus: string }[] = [
  { title: "Foundations", focus: "Sounds, greetings, and the present tense" },
  { title: "Everyday Talk", focus: "Small talk, numbers, and asking questions" },
  { title: "Past & Future", focus: "Telling stories about what happened" },
  { title: "Describing Things", focus: "Adjectives, comparisons, and detail" },
  { title: "Getting Around", focus: "Directions, travel, and transactions" },
  { title: "Work & Study", focus: "Workplace vocabulary and formal register" },
  { title: "Opinions", focus: "Agreeing, disagreeing, and giving reasons" },
  { title: "Listening Deeply", focus: "Accents, speed, and idiom" },
  { title: "Writing Clearly", focus: "Emails, summaries, and structure" },
  { title: "Pronunciation", focus: "Stress, rhythm, and intonation" },
  { title: "Fluency Push", focus: "Speaking at length without rehearsing" },
  { title: "Assessment", focus: "Mock interviews and the final evaluation" },
];

/**
 * How much of the programme is authored so far. Weeks 1-3 are fully published,
 * week 4 is mid-edit, the rest are untouched — enough variety that every badge
 * state shows up on screen.
 */
function seedStatus(weekNumber: number, weekday: number): ContentStatus {
  if (weekNumber <= 3) return "published";
  if (weekNumber === 4) return weekday <= 2 ? "published" : "draft";
  if (weekNumber === 5) return weekday === 1 ? "draft" : "empty";
  return "empty";
}

function buildDay(weekNumber: number, weekday: number): CurriculumDay {
  const dayNumber = (weekNumber - 1) * TEACHING_DAYS_PER_WEEK + weekday;
  const status = seedStatus(weekNumber, weekday);
  const authored = status !== "empty";

  return {
    dayNumber,
    weekday,
    title: `Day ${dayNumber}`,
    video: {
      title: `Class ${dayNumber}`,
      durationMin: authored ? 18 + ((dayNumber * 7) % 25) : null,
      assetKey: status === "published" ? `classes/day-${dayNumber}.mp4` : null,
      fileName: null,
      partCount: status === "published" ? 1 : 0,
      status,
    },
    videos: [],
    notes: {
      title: `Day ${dayNumber} notes`,
      assetKey: status === "published" ? `notes/day-${dayNumber}.pdf` : null,
      fileName: null,
      status,
    },
    task: {
      title: `Day ${dayNumber} task`,
      prompt: authored
        ? "Record a 2-minute answer using today's structures."
        : "",
      questionCount: 0,
      status,
    },
  };
}

function buildQuizzes(weekNumber: number): WeekendQuiz[] {
  const status = weekNumber <= 3 ? "published" : weekNumber === 4 ? "draft" : "empty";
  const authored = status !== "empty";

  return [
    {
      id: `w${weekNumber}-sat`,
      quizId: null,
      day: "saturday",
      title: `Week ${weekNumber} practice`,
      kind: "practice",
      questionCount: authored ? 10 : 0,
      status,
    },
    {
      id: `w${weekNumber}-sun`,
      quizId: null,
      day: "sunday",
      title: `Week ${weekNumber} assessment`,
      kind: "assessment",
      questionCount: authored ? 20 : 0,
      status,
    },
  ];
}

/** The full 12-week scaffold: 60 numbered days + 24 weekend quizzes. */
export function buildCurriculum(): CurriculumWeek[] {
  return Array.from({ length: WEEKS_IN_PROGRAMME }, (_, i) => {
    const weekNumber = i + 1;
    const theme = WEEK_THEMES[i];

    return {
      weekNumber,
      title: theme.title,
      focus: theme.focus,
      days: Array.from({ length: TEACHING_DAYS_PER_WEEK }, (_, d) =>
        buildDay(weekNumber, d + 1),
      ),
      quizzes: buildQuizzes(weekNumber),
    };
  });
}

/** Every content slot in a week: 5 days x 3 assets, plus the 2 quizzes. */
export function weekSlotCount(): number {
  return TEACHING_DAYS_PER_WEEK * 3 + QUIZZES_PER_WEEK;
}

/** How many of a week's slots are published — used for the week rail meter. */
export function publishedSlots(week: CurriculumWeek): number {
  const slots: ContentStatus[] = [
    ...week.days.flatMap((d) => [d.video.status, d.notes.status, d.task.status]),
    ...week.quizzes.map((q) => q.status),
  ];
  return slots.filter((s) => s === "published").length;
}

/**
 * A brand-new, empty week appended to the programme. Day numbers are assigned
 * by `renumberWeeks` afterwards, so the placeholder 0 here never reaches the UI.
 */
export function createWeek(title: string, focus: string): CurriculumWeek {
  return {
    weekNumber: 0,
    title,
    focus,
    days: Array.from({ length: TEACHING_DAYS_PER_WEEK }, (_, d) => ({
      dayNumber: 0,
      weekday: d + 1,
      title: "Day 0",
      video: {
        title: "Class",
        durationMin: null,
        assetKey: null,
        fileName: null,
        partCount: 0,
        status: "empty",
      },
      videos: [],
      notes: { title: "Notes", assetKey: null, fileName: null, status: "empty" },
      task: { title: "Task", prompt: "", questionCount: 0, status: "empty" },
    })),
    quizzes: [
      {
        id: "sat",
        quizId: null,
        day: "saturday",
        title: "Practice",
        kind: "practice",
        questionCount: 0,
        status: "empty",
      },
      {
        id: "sun",
        quizId: null,
        day: "sunday",
        title: "Assessment",
        kind: "assessment",
        questionCount: 0,
        status: "empty",
      },
    ],
  };
}

/**
 * Reassign week numbers, day numbers and quiz ids to match array order.
 * Must run after any insert or removal — day numbers are positional (1..N*5),
 * so deleting week 2 has to pull every later day down by 5.
 */
export function renumberWeeks(weeks: CurriculumWeek[]): CurriculumWeek[] {
  return weeks.map((week, i) => {
    const weekNumber = i + 1;

    return {
      ...week,
      weekNumber,
      days: week.days.map((day, d) => {
        const weekday = d + 1;
        const dayNumber = i * TEACHING_DAYS_PER_WEEK + weekday;
        const renamed = day.title === `Day ${day.dayNumber}`;

        return {
          ...day,
          dayNumber,
          weekday,
          // Only rewrite auto-generated titles; an authored one is left alone.
          title: renamed ? `Day ${dayNumber}` : day.title,
        };
      }),
      quizzes: week.quizzes.map((quiz) => ({
        ...quiz,
        id: `w${weekNumber}-${quiz.day === "saturday" ? "sat" : "sun"}`,
      })),
    };
  });
}

/** Teaching days across the whole programme — 5 per week, however many weeks. */
export function teachingDayCount(weeks: CurriculumWeek[]): number {
  return weeks.length * TEACHING_DAYS_PER_WEEK;
}

/** The week a given teaching day belongs to. 1-indexed, 5 days per week. */
export function weekNumberForDay(dayNumber: number): number {
  return Math.floor((dayNumber - 1) / TEACHING_DAYS_PER_WEEK) + 1;
}

/** Look up one teaching day by its 1..60 number, with the week it sits in. */
export function findDay(
  weeks: CurriculumWeek[],
  dayNumber: number,
): { day: CurriculumDay; week: CurriculumWeek } | null {
  const week = weeks[weekNumberForDay(dayNumber) - 1];
  const day = week?.days.find((d) => d.dayNumber === dayNumber);
  return week && day ? { day, week } : null;
}

/** How students engaged with one day's material. */
export type DayEngagement = {
  /** Students who have reached this day. */
  reached: number;
  videoViews: number;
  notesOpened: number;
  tasksCompleted: number;
};

/**
 * Scaffold engagement numbers. Deterministic from `dayNumber` — no randomness,
 * so server and client render identical values and the page can stay static.
 * Unpublished days report zeroes, since nobody can have seen them.
 */
export function dayEngagement(day: CurriculumDay): DayEngagement {
  const cohort = 42;
  if (day.video.status === "empty") {
    return { reached: 0, videoViews: 0, notesOpened: 0, tasksCompleted: 0 };
  }

  // Attrition: fewer students have reached the later days of the programme.
  const reached = Math.max(6, cohort - Math.floor(day.dayNumber * 0.4));
  const videoViews = Math.round(reached * 0.86);
  const notesOpened = Math.round(reached * 0.61);
  const tasksCompleted = Math.round(reached * 0.48);

  return { reached, videoViews, notesOpened, tasksCompleted };
}

/** Programme-wide rollup for the page header. */
export function curriculumStats(weeks: CurriculumWeek[]) {
  const published = weeks.reduce((sum, w) => sum + publishedSlots(w), 0);
  const total = weeks.length * weekSlotCount();
  return {
    published,
    total,
    percent: total === 0 ? 0 : Math.round((published / total) * 100),
  };
}
