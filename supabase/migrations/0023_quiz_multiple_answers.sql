-- Add single-answer and multiple-answer MCQ modes to assessment questions.
-- Existing questions remain single-answer and retain their current answer.

alter table public.content_quiz_questions
  add column if not exists answer_mode text not null default 'single',
  add column if not exists correct_indices jsonb not null default '[]'::jsonb;

update public.content_quiz_questions
set correct_indices = jsonb_build_array(correct_index)
where correct_indices = '[]'::jsonb;

alter table public.content_quiz_questions
  alter column correct_indices set default '[0]'::jsonb;

alter table public.content_quiz_questions
  drop constraint if exists content_quiz_questions_answer_mode_check;

alter table public.content_quiz_questions
  add constraint content_quiz_questions_answer_mode_check
  check (answer_mode in ('single', 'multiple'));

alter table public.content_quiz_questions
  drop constraint if exists content_quiz_questions_correct_indices_array_check;

alter table public.content_quiz_questions
  add constraint content_quiz_questions_correct_indices_array_check
  check (
    jsonb_typeof(correct_indices) = 'array'
    and jsonb_array_length(correct_indices) >= 1
    and (
      (answer_mode = 'single' and jsonb_array_length(correct_indices) = 1)
      or (answer_mode = 'multiple' and jsonb_array_length(correct_indices) >= 2)
    )
  );
