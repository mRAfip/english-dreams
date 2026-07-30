-- 0015_day_videos.sql
-- A day's class can be several videos ("parts"), not just one. Each part is an
-- ordered R2 object; the notes stay a single file in content_assets. We also
-- track which parts a student has watched so a day only counts as "watched" once
-- they've played EVERY part.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

create table if not exists public.content_day_videos (
  id           uuid primary key default gen_random_uuid(),
  day_id       uuid not null references public.content_days (id) on delete cascade,
  -- 1..N ordering within the day. Part titles are derived from this.
  position     int not null,
  r2_key       text not null,
  file_name    text,
  content_type text,
  size_bytes   bigint,
  duration_min int,
  status       public.content_status not null default 'draft',
  uploaded_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (day_id, position)
);

create index if not exists content_day_videos_day_idx
  on public.content_day_videos (day_id);

drop trigger if exists content_day_videos_touch on public.content_day_videos;
create trigger content_day_videos_touch
  before update on public.content_day_videos
  for each row execute function public.touch_updated_at();

-- RLS: anyone signed in can read the parts (the app hides unpublished ones);
-- only admins write. Mirrors content_assets (0006).
alter table public.content_day_videos enable row level security;

drop policy if exists content_day_videos_read on public.content_day_videos;
create policy content_day_videos_read on public.content_day_videos
  for select to authenticated using (true);

drop policy if exists content_day_videos_admin_write on public.content_day_videos;
create policy content_day_videos_admin_write on public.content_day_videos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Per-part watch tracking. The array holds content_day_videos ids the student
-- has played; video_watched flips true once it covers every published part.
alter table public.student_day_progress
  add column if not exists watched_video_parts uuid[] not null default '{}';
