-- 0020_task_comments_question_id.sql
-- Add question_id to task_review_comments to allow comments on specific questions.

ALTER TABLE public.task_review_comments 
  ADD COLUMN question_id uuid REFERENCES public.task_questions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS task_review_comments_question_idx 
  ON public.task_review_comments(question_id);
