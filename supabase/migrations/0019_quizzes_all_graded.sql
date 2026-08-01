-- 0019_quizzes_all_graded.sql
-- Both weekend papers are now graded assessments. Historically the Saturday
-- paper was a "practice" run and only Sunday was graded; a client review asked
-- for both to count. This converts any existing Saturday practice papers to
-- assessments and drops the now-meaningless 'practice' from the kind check.
-- Run in the Supabase SQL editor (or `supabase db push`).

update public.content_quizzes
  set kind = 'assessment'
  where kind = 'practice';

alter table public.content_quizzes
  drop constraint if exists content_quizzes_kind_check;

alter table public.content_quizzes
  add constraint content_quizzes_kind_check check (kind in ('assessment'));
