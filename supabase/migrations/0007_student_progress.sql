-- 0007_student_progress.sql
-- Per-student progress through the curriculum: one row per (student, teaching
-- day) tracking whether they've watched the class, downloaded the notes, and
-- completed the day's task. Run in the Supabase SQL editor (or `supabase db push`).
--
-- The row is created lazily — the first time a student acts on a day. Absence of
-- a row means "nothing done yet", so the app treats a missing row as all-false.

create table if not exists public.student_day_progress (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  day_id            uuid not null references public.content_days (id) on delete cascade,
  video_watched     boolean not null default false,
  notes_downloaded  boolean not null default false,
  task_completed    boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- One progress row per student per day.
  unique (user_id, day_id)
);

create index if not exists student_day_progress_user_id_idx
  on public.student_day_progress (user_id);
create index if not exists student_day_progress_day_id_idx
  on public.student_day_progress (day_id);

-- Keep updated_at honest (reuses public.touch_updated_at from 0001).
drop trigger if exists student_day_progress_touch on public.student_day_progress;
create trigger student_day_progress_touch
  before update on public.student_day_progress
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: a student owns their own rows. Admins (and trainers, for review and the
-- leaderboard) may read everyone's.
-- ---------------------------------------------------------------------------
alter table public.student_day_progress enable row level security;

drop policy if exists sdp_select_own_or_staff on public.student_day_progress;
create policy sdp_select_own_or_staff on public.student_day_progress
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_role(auth.uid(), 'trainer')
  );

-- Students may only create/update/delete their OWN progress rows.
drop policy if exists sdp_insert_own on public.student_day_progress;
create policy sdp_insert_own on public.student_day_progress
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists sdp_update_own on public.student_day_progress;
create policy sdp_update_own on public.student_day_progress
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists sdp_delete_own on public.student_day_progress;
create policy sdp_delete_own on public.student_day_progress
  for delete to authenticated
  using (user_id = auth.uid());
