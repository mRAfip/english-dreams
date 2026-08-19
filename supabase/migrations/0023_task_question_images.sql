-- 0023_task_question_images.sql
-- Add optional image attachment field to task_questions table.

alter table public.task_questions
  add column if not exists image_key text;
