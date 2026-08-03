-- 0021_courses.sql
-- Introduces COURSES above the curriculum. Until now the app hosted exactly one
-- programme: content_weeks was a flat 1..N list and every student walked it.
-- Now an admin creates a course (Basic, Intermediate, ...) and authors content
-- inside it; a student is assigned one course and sees only that content.
--
-- The shape of a course is unchanged — weeks, each with 5 teaching days and 2
-- weekend quizzes. Only the container is new. Everything below content_weeks
-- (days, assets, video parts, quizzes, questions) inherits its course through
-- the week, so those tables are untouched.
--
-- Day numbering stays positional but is now scoped to a course:
--   day_number = (week_number - 1) * 5 + weekday,  within the course.
-- So "Day 12" of Basic and "Day 12" of Intermediate are different days.
--
-- DESTRUCTIVE: this wipes the existing curriculum (test data only) so courses
-- start clean. Student accounts, roles, trainer links and messages survive;
-- their progress/attempt rows go with the days they pointed at.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

-- ---------------------------------------------------------------------------
-- 0. Wipe the single-programme curriculum.
--
-- Deleting content_weeks cascades all the way down: days -> assets, video
-- parts, task questions, submissions, progress rows; quizzes -> questions,
-- attempts. Certificates and student_access rows are NOT touched.
--
-- R2 objects for the old content are orphaned by this. They cost pennies and
-- are unreachable; delete the `content/` prefix in the R2 console if you want
-- the bucket clean.
--
-- Guarded on content_courses not existing yet, so this only fires on the FIRST
-- run. Re-pasting the file into the SQL editor after courses have been authored
-- must not wipe real content — every other statement below is idempotent, and
-- this one has to be too.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'content_courses'
  ) then
    delete from public.content_weeks;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. content_courses — the new top level.
--
-- `slug` is what appears in admin URLs (/admin/content-management/basic), so it
-- is unique and url-safe. `status` reuses the shared content_status enum: a
-- course must be 'published' before its students can see anything.
-- ---------------------------------------------------------------------------
create table if not exists public.content_courses (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique
                 check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text not null,
  -- One-line description shown on the course card and to students.
  description  text not null default '',
  -- Free-text level label ("Beginner", "B1", ...). Not an enum: the levels a
  -- school uses change more often than a migration should.
  level        text not null default '',
  -- Ordering in the admin list and the student-assignment dropdown.
  position     int  not null default 1,
  status       public.content_status not null default 'draft',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists content_courses_position_idx
  on public.content_courses (position);

drop trigger if exists content_courses_touch on public.content_courses;
create trigger content_courses_touch
  before update on public.content_courses
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. content_weeks.course_id — every week now belongs to a course.
--
-- On a first run the table was emptied in step 0, so the column can be NOT NULL
-- immediately and no backfill is needed. On a re-run every row already has a
-- course, so the delete below is a no-op. Deleting a course removes its whole
-- curriculum.
-- ---------------------------------------------------------------------------
alter table public.content_weeks
  add column if not exists course_id uuid;

-- Guard for a re-run against a database where step 0 was skipped: any orphan
-- week would block the NOT NULL below, so drop leftovers rather than fail.
delete from public.content_weeks where course_id is null;

alter table public.content_weeks
  alter column course_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'content_weeks_course_id_fkey'
  ) then
    alter table public.content_weeks
      add constraint content_weeks_course_id_fkey
      foreign key (course_id) references public.content_courses (id)
      on delete cascade;
  end if;
end
$$;

create index if not exists content_weeks_course_id_idx
  on public.content_weeks (course_id);

-- week_number is unique WITHIN a course now, not globally. Still deferrable so
-- a bulk renumber after a delete doesn't trip a transient collision mid-pass.
alter table public.content_weeks
  drop constraint if exists content_weeks_week_number_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'content_weeks_course_week_key'
  ) then
    alter table public.content_weeks
      add constraint content_weeks_course_week_key
      unique (course_id, week_number) deferrable initially deferred;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. The student -> course assignment.
--
-- It lives on student_access, which is already one row per student, already
-- admin-managed, already seeded when a student is created, and already has the
-- right RLS (admins write; a student reads their own row). A separate table
-- would duplicate all of that for one column.
--
-- NULL means "not assigned yet" — the student sees an empty learning path with
-- an explanatory state, never a crash. `on delete set null` so deleting a
-- course unassigns its students instead of deleting them.
-- ---------------------------------------------------------------------------
alter table public.student_access
  add column if not exists course_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'student_access_course_id_fkey'
  ) then
    alter table public.student_access
      add constraint student_access_course_id_fkey
      foreign key (course_id) references public.content_courses (id)
      on delete set null;
  end if;
end
$$;

create index if not exists student_access_course_id_idx
  on public.student_access (course_id);

-- ---------------------------------------------------------------------------
-- 4. RLS — same rule as the rest of the curriculum: any signed-in user reads,
-- only admins write. Students need read access because their own course row is
-- resolved through this table.
-- ---------------------------------------------------------------------------
alter table public.content_courses enable row level security;

drop policy if exists content_courses_read on public.content_courses;
create policy content_courses_read on public.content_courses
  for select to authenticated using (true);

drop policy if exists content_courses_admin_write on public.content_courses;
create policy content_courses_admin_write on public.content_courses
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. A trainer needs to read student_access to know which course each of THEIR
-- students is on — progress must be measured against that student's own
-- curriculum, not a shared one.
--
-- Scoped with is_student_staff (from 0018) rather than a blanket trainer check:
-- the row also carries fee_status and the admin's private note, which are none
-- of another trainer's business. A trainer sees only their assigned students.
-- Read only — the admin write policy from 0010 is unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists sa_select on public.student_access;
create policy sa_select on public.student_access
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_student_staff(student_id)
  );

-- No seed data. The admin creates the first course from
-- /admin/content-management, then builds its weeks exactly as before.
