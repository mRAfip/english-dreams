-- Allow True/False assessment questions. They use the existing options and
-- correct_indices columns with fixed ["True", "False"] options.

alter table public.content_quiz_questions
  drop constraint if exists content_quiz_questions_answer_mode_check;

alter table public.content_quiz_questions
  add constraint content_quiz_questions_answer_mode_check
  check (answer_mode in ('single', 'multiple', 'true_false'));

alter table public.content_quiz_questions
  drop constraint if exists content_quiz_questions_correct_indices_array_check;

alter table public.content_quiz_questions
  add constraint content_quiz_questions_correct_indices_array_check
  check (
    jsonb_typeof(correct_indices) = 'array'
    and jsonb_array_length(correct_indices) >= 1
    and (
      (answer_mode in ('single', 'true_false') and jsonb_array_length(correct_indices) = 1)
      or (answer_mode = 'multiple' and jsonb_array_length(correct_indices) >= 2)
    )
  );
