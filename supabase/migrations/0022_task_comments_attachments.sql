-- 0022_task_comments_attachments.sql
-- Add attachment fields to task_review_comments for voice messages and document sharing.

alter table public.task_review_comments
  add column if not exists attachment_key  text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text,
  add column if not exists attachment_size bigint,
  add column if not exists attachment_kind text;

alter table public.task_review_comments
  drop constraint if exists task_comments_attachment_kind_check;
alter table public.task_review_comments
  add constraint task_comments_attachment_kind_check
  check (attachment_kind is null or attachment_kind in ('image', 'audio', 'file'));
