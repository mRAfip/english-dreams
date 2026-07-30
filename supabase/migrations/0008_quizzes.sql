-- 0008_quizzes.sql
-- Weekend quizzes: the practice (Saturday) and graded assessment (Sunday) paper
-- for each week, their multiple-choice questions, and per-student attempts.
-- Run in the Supabase SQL editor (or `supabase db push`).
--
-- A quiz belongs to a week (two per week: saturday=practice, sunday=assessment).
-- Questions store the correct option index + an explanation shown after marking.
-- Marking is done server-side (see lib/quiz/actions.ts) and the score is stored
-- in student_quiz_attempts.

-- ---------------------------------------------------------------------------
-- content_quizzes: one paper per (week, weekend day).
-- ---------------------------------------------------------------------------
create table if not exists public.content_quizzes (
  id          uuid primary key default gen_random_uuid(),
  week_id     uuid not null references public.content_weeks (id) on delete cascade,
  day         text not null check (day in ('saturday', 'sunday')),
  kind        text not null check (kind in ('practice', 'assessment')),
  title       text not null default '',
  status      public.content_status not null default 'empty',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (week_id, day)
);

create index if not exists content_quizzes_week_id_idx
  on public.content_quizzes (week_id);

-- ---------------------------------------------------------------------------
-- content_quiz_questions: the multiple-choice items in a paper.
-- `options` is a JSON array of strings; `correct_index` points into it.
-- ---------------------------------------------------------------------------
create table if not exists public.content_quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.content_quizzes (id) on delete cascade,
  position      int  not null,
  prompt        text not null default '',
  options       jsonb not null default '[]'::jsonb,
  correct_index int  not null default 0,
  explanation   text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (quiz_id, position)
);

create index if not exists content_quiz_questions_quiz_id_idx
  on public.content_quiz_questions (quiz_id);

-- ---------------------------------------------------------------------------
-- student_quiz_attempts: one row per (student, quiz) — the latest attempt.
-- ---------------------------------------------------------------------------
create table if not exists public.student_quiz_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  quiz_id        uuid not null references public.content_quizzes (id) on delete cascade,
  score          int  not null,   -- 0..100
  correct_count  int  not null,
  total          int  not null,
  answers        jsonb not null default '[]'::jsonb, -- chosen option index per question
  submitted_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, quiz_id)
);

create index if not exists student_quiz_attempts_user_id_idx
  on public.student_quiz_attempts (user_id);
create index if not exists student_quiz_attempts_quiz_id_idx
  on public.student_quiz_attempts (quiz_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse public.touch_updated_at from 0001).
-- ---------------------------------------------------------------------------
drop trigger if exists content_quizzes_touch on public.content_quizzes;
create trigger content_quizzes_touch
  before update on public.content_quizzes
  for each row execute function public.touch_updated_at();

drop trigger if exists content_quiz_questions_touch on public.content_quiz_questions;
create trigger content_quiz_questions_touch
  before update on public.content_quiz_questions
  for each row execute function public.touch_updated_at();

drop trigger if exists student_quiz_attempts_touch on public.student_quiz_attempts;
create trigger student_quiz_attempts_touch
  before update on public.student_quiz_attempts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.content_quizzes         enable row level security;
alter table public.content_quiz_questions  enable row level security;
alter table public.student_quiz_attempts   enable row level security;

-- Quizzes + questions: any signed-in user reads, only admins write.
drop policy if exists content_quizzes_read on public.content_quizzes;
create policy content_quizzes_read on public.content_quizzes
  for select to authenticated using (true);

drop policy if exists content_quizzes_admin_write on public.content_quizzes;
create policy content_quizzes_admin_write on public.content_quizzes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists content_quiz_questions_read on public.content_quiz_questions;
create policy content_quiz_questions_read on public.content_quiz_questions
  for select to authenticated using (true);

drop policy if exists content_quiz_questions_admin_write on public.content_quiz_questions;
create policy content_quiz_questions_admin_write on public.content_quiz_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Attempts: a student owns their own; staff may read for review/leaderboard.
drop policy if exists sqa_select_own_or_staff on public.student_quiz_attempts;
create policy sqa_select_own_or_staff on public.student_quiz_attempts
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_role(auth.uid(), 'trainer')
  );

drop policy if exists sqa_insert_own on public.student_quiz_attempts;
create policy sqa_insert_own on public.student_quiz_attempts
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists sqa_update_own on public.student_quiz_attempts;
create policy sqa_update_own on public.student_quiz_attempts
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
