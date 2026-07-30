-- 0014_message_attachments.sql
-- Attachments on chat messages. One attachment per message: the file lives in
-- Cloudflare R2 (private bucket) and its object key is stored here. Served
-- through /api/attachment/<messageId>, which redirects to a presigned GET after
-- RLS confirms the viewer is a member of the conversation.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

alter table public.messages
  add column if not exists attachment_key  text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text,
  add column if not exists attachment_size bigint,
  add column if not exists attachment_kind text;

-- Kind drives how the bubble renders: inline image, audio player, or file chip.
alter table public.messages
  drop constraint if exists messages_attachment_kind_check;
alter table public.messages
  add constraint messages_attachment_kind_check
  check (attachment_kind is null or attachment_kind in ('image', 'audio', 'file'));
