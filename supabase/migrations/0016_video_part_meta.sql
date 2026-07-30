-- 0016_video_part_meta.sql
-- Give each video part a title and a short description so students get context
-- ("Greetings — role-play warm-up") instead of a bare "Part 1". Both optional;
-- the app falls back to "Part N" when no title is set.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

alter table public.content_day_videos
  add column if not exists title       text,
  add column if not exists description text;
