import { createClient } from "@/lib/supabase/server";
import {
  TEACHING_DAYS_PER_WEEK,
  type ContentStatus,
  type CurriculumDay,
  type CurriculumWeek,
  type WeekendQuiz,
} from "@/types/content";
import type {
  AdminQuiz,
  QuizDay,
  QuizKind,
  QuizQuestion,
} from "@/types/quiz";

// Read the curriculum from Supabase and assemble it into the CurriculumWeek[]
// shape the admin UI already renders. This replaces buildCurriculum() (the
// in-memory scaffold) as the data source for /admin/content-management.
//
// Day numbering is positional: a day's global 1..60 number is derived from its
// week's order and its weekday, never stored (see 0006_content.sql).

type AssetRow = {
  kind: "video" | "notes";
  r2_key: string;
  file_name: string | null;
  duration_min: number | null;
  status: ContentStatus;
};

type VideoRow = {
  id: string;
  position: number;
  title: string | null;
  description: string | null;
  r2_key: string;
  thumbnail_key: string | null;
  file_name: string | null;
  duration_min: number | null;
  status: ContentStatus;
};

type DayRow = {
  id: string;
  weekday: number;
  title: string;
  task_title: string;
  task_prompt: string;
  task_status: ContentStatus;
  content_assets: AssetRow[] | null;
  content_day_videos: VideoRow[] | null;
  task_questions: { count: number }[] | null;
};

type QuizRow = {
  id: string;
  day: "saturday" | "sunday";
  kind: "practice" | "assessment";
  title: string;
  status: ContentStatus;
  content_quiz_questions: { count: number }[] | null;
};

type WeekRow = {
  id: string;
  week_number: number;
  title: string;
  focus: string;
  content_days: DayRow[] | null;
  content_quizzes: QuizRow[] | null;
};

const WEEK_SELECT =
  "id, week_number, title, focus, content_days(id, weekday, title, task_title, task_prompt, task_status, content_assets(kind, r2_key, file_name, duration_min, status), content_day_videos(id, position, title, description, r2_key, thumbnail_key, file_name, duration_min, status), task_questions(count)), content_quizzes(id, day, kind, title, status, content_quiz_questions(count))";

/**
 * The week's two weekend papers. A DB row is used when the admin has created
 * it; otherwise an empty placeholder stands in so the UI always shows both.
 */
function mapQuizzes(week: WeekRow): WeekendQuiz[] {
  const rows = week.content_quizzes ?? [];
  const byDay = (day: "saturday" | "sunday") => rows.find((q) => q.day === day);

  const build = (
    day: "saturday" | "sunday",
    kind: "practice" | "assessment",
  ): WeekendQuiz => {
    const row = byDay(day);
    const slug = `w${week.week_number}-${day === "saturday" ? "sat" : "sun"}`;
    if (!row) {
      return {
        id: slug,
        quizId: null,
        day,
        title: `Week ${week.week_number} ${kind}`,
        kind,
        questionCount: 0,
        status: "empty",
      };
    }
    return {
      id: slug,
      quizId: row.id,
      day,
      title: row.title || `Week ${week.week_number} ${kind}`,
      kind: row.kind,
      questionCount: row.content_quiz_questions?.[0]?.count ?? 0,
      status: row.status,
    };
  };

  return [build("saturday", "practice"), build("sunday", "assessment")];
}

/** Summary status over the parts: published if any is, draft if any exists. */
function summaryStatus(parts: { status: ContentStatus }[]): ContentStatus {
  if (parts.some((p) => p.status === "published")) return "published";
  if (parts.length > 0) return "draft";
  return "empty";
}

function mapDay(week: WeekRow, row: DayRow): CurriculumDay {
  const dayNumber =
    (week.week_number - 1) * TEACHING_DAYS_PER_WEEK + row.weekday;
  const assets = row.content_assets ?? [];
  const notes = assets.find((a) => a.kind === "notes");

  const parts = (row.content_day_videos ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((v) => ({
      id: v.id,
      position: v.position,
      title: v.title,
      description: v.description,
      durationMin: v.duration_min,
      assetKey: v.r2_key,
      thumbnailKey: v.thumbnail_key,
      fileName: v.file_name,
      status: v.status,
    }));

  const totalDuration = parts.reduce((sum, p) => sum + (p.durationMin ?? 0), 0);

  return {
    dayNumber,
    weekday: row.weekday,
    title: row.title || `Day ${dayNumber}`,
    video: {
      title: `Class ${dayNumber}`,
      durationMin: totalDuration || null,
      assetKey: parts[0]?.assetKey ?? null,
      fileName: parts[0]?.fileName ?? null,
      partCount: parts.length,
      status: summaryStatus(parts),
    },
    videos: parts,
    notes: {
      title: `Day ${dayNumber} notes`,
      assetKey: notes?.r2_key ?? null,
      fileName: notes?.file_name ?? null,
      status: notes?.status ?? "empty",
    },
    task: {
      title: row.task_title || `Day ${dayNumber} task`,
      prompt: row.task_prompt,
      questionCount: row.task_questions?.[0]?.count ?? 0,
      status: row.task_status,
    },
  };
}

function mapWeek(row: WeekRow): CurriculumWeek {
  const days = (row.content_days ?? [])
    .slice()
    .sort((a, b) => a.weekday - b.weekday)
    .map((d) => mapDay(row, d));

  return {
    weekNumber: row.week_number,
    title: row.title,
    focus: row.focus,
    days,
    quizzes: mapQuizzes(row),
  };
}

/** The full curriculum, ordered by week, assembled from the content tables. */
export async function getCurriculum(): Promise<CurriculumWeek[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_weeks")
    .select(WEEK_SELECT)
    .order("week_number", { ascending: true });

  if (error) {
    throw new Error(`Failed to load curriculum: ${error.message}`);
  }

  return ((data ?? []) as WeekRow[]).map(mapWeek);
}

/** One teaching day (1..60) with the week it belongs to, or null if not found. */
export async function getDay(
  dayNumber: number,
): Promise<{ day: CurriculumDay; week: CurriculumWeek } | null> {
  const weekNumber =
    Math.floor((dayNumber - 1) / TEACHING_DAYS_PER_WEEK) + 1;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_weeks")
    .select(WEEK_SELECT)
    .eq("week_number", weekNumber)
    .maybeSingle();

  if (error || !data) return null;

  const week = mapWeek(data as WeekRow);
  const day = week.days.find((d) => d.dayNumber === dayNumber);
  return day ? { day, week } : null;
}

const KIND_FOR: Record<QuizDay, QuizKind> = {
  saturday: "practice",
  sunday: "assessment",
};

/**
 * A weekend paper for the admin builder. Returns the existing quiz + questions,
 * or an empty shell (id "") when the admin hasn't created it yet. Null only if
 * the week itself doesn't exist.
 */
export async function getAdminQuiz(
  weekNumber: number,
  day: QuizDay,
): Promise<AdminQuiz | null> {
  const supabase = await createClient();

  const { data: week } = await supabase
    .from("content_weeks")
    .select("id")
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (!week) return null;

  const kind = KIND_FOR[day];

  const { data: quiz } = await supabase
    .from("content_quizzes")
    .select(
      "id, day, kind, title, status, content_quiz_questions(id, position, prompt, options, correct_index, explanation)",
    )
    .eq("week_id", week.id)
    .eq("day", day)
    .maybeSingle();

  if (!quiz) {
    return {
      id: "",
      weekNumber,
      day,
      kind,
      title: `Week ${weekNumber} ${kind}`,
      status: "empty",
      questions: [],
    };
  }

  type QRow = {
    id: string;
    position: number;
    prompt: string;
    options: string[];
    correct_index: number;
    explanation: string;
  };
  const questions: QuizQuestion[] = ((quiz.content_quiz_questions ?? []) as QRow[])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: Array.isArray(q.options) ? q.options : [],
      correctIndex: q.correct_index,
      explanation: q.explanation,
    }));

  return {
    id: quiz.id as string,
    weekNumber,
    day,
    kind: (quiz.kind as QuizKind) ?? kind,
    title: (quiz.title as string) || `Week ${weekNumber} ${kind}`,
    status: quiz.status as AdminQuiz["status"],
    questions,
  };
}
