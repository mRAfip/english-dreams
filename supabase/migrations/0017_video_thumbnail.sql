-- 0017_video_thumbnail.sql
-- Optional thumbnail image per video part — a poster the student sees in the
-- playlist and on the player, for a more attractive UI. Stored in R2 like the
-- video itself; this holds the object key.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

alter table public.content_day_videos
  add column if not exists thumbnail_key text;
