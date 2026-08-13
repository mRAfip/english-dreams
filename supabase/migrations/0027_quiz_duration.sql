-- 0027_quiz_duration.sql
-- Each of the two weekly assessments has an admin-configured time limit.

alter table public.content_quizzes
  add column if not exists duration_minutes int not null default 30;

alter table public.content_quizzes
  drop constraint if exists content_quizzes_duration_minutes_check;

alter table public.content_quizzes
  add constraint content_quizzes_duration_minutes_check
  check (duration_minutes between 1 and 300);
