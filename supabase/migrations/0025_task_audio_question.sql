-- Add a task question whose prompt is text but whose required response is audio.

alter type public.task_question_type add value if not exists 'audio';
