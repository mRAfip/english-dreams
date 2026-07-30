-- 0018_tasks.sql
-- Real daily tasks: admins author typed questions, students submit answers
-- (text and/or an audio clip), and the assigned trainer reviews them with a
-- realtime comment thread and an approve / request-redo decision.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

-- Question types. 'comprehension' carries a passage + follow-up questions.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_question_type') then
    create type public.task_question_type as enum
      ('text', 'editing', 'fill_blanks', 'comprehension');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_submission_status') then
    create type public.task_submission_status as enum
      ('submitted', 'approved', 'redo');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Questions (authored by admins, part of the day's content)
-- ---------------------------------------------------------------------------
create table if not exists public.task_questions (
  id         uuid primary key default gen_random_uuid(),
  day_id     uuid not null references public.content_days (id) on delete cascade,
  position   int  not null,
  type       public.task_question_type not null default 'text',
  prompt     text not null default '',
  passage    text,                    -- comprehension only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (day_id, position)
);
create index if not exists task_questions_day_idx on public.task_questions (day_id);

drop trigger if exists task_questions_touch on public.task_questions;
create trigger task_questions_touch before update on public.task_questions
  for each row execute function public.touch_updated_at();

create table if not exists public.task_question_followups (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.task_questions (id) on delete cascade,
  position    int  not null,
  prompt      text not null default '',
  unique (question_id, position)
);
create index if not exists task_question_followups_q_idx
  on public.task_question_followups (question_id);

-- ---------------------------------------------------------------------------
-- Submissions + answers (one submission per student per day, resubmittable)
-- ---------------------------------------------------------------------------
create table if not exists public.task_submissions (
  id           uuid primary key default gen_random_uuid(),
  day_id       uuid not null references public.content_days (id) on delete cascade,
  student_id   uuid not null references auth.users (id) on delete cascade,
  status       public.task_submission_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (day_id, student_id)
);
create index if not exists task_submissions_student_idx
  on public.task_submissions (student_id);
create index if not exists task_submissions_day_idx
  on public.task_submissions (day_id);

drop trigger if exists task_submissions_touch on public.task_submissions;
create trigger task_submissions_touch before update on public.task_submissions
  for each row execute function public.touch_updated_at();

create table if not exists public.submission_answers (
  id                uuid primary key default gen_random_uuid(),
  submission_id     uuid not null references public.task_submissions (id) on delete cascade,
  question_id       uuid not null references public.task_questions (id) on delete cascade,
  -- Set only for a comprehension follow-up answer; null = the question itself.
  followup_id       uuid references public.task_question_followups (id) on delete cascade,
  answer_text       text,
  audio_key         text,
  audio_name        text,
  audio_type        text,
  audio_duration_min int,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists submission_answers_submission_idx
  on public.submission_answers (submission_id);

drop trigger if exists submission_answers_touch on public.submission_answers;
create trigger submission_answers_touch before update on public.submission_answers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Review comment thread (realtime) between the student and their trainer
-- ---------------------------------------------------------------------------
create table if not exists public.task_review_comments (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.task_submissions (id) on delete cascade,
  author_id     uuid references auth.users (id) on delete set null,
  body          text not null,
  created_at    timestamptz not null default now()
);
create index if not exists task_review_comments_submission_idx
  on public.task_review_comments (submission_id, created_at);

-- ---------------------------------------------------------------------------
-- Access helper: who may see a submission — its student, that student's
-- trainer, or an admin. SECURITY DEFINER to keep policies simple + recursion-free.
-- ---------------------------------------------------------------------------
create or replace function public.can_access_submission(sub uuid)
  returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.task_submissions s
    where s.id = sub
      and (
        s.student_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1 from public.student_trainer_assignments a
          where a.student_id = s.student_id and a.trainer_id = auth.uid()
        )
      )
  );
$$;

-- Same predicate but for a student id (used by submissions' own policies).
create or replace function public.is_student_staff(student uuid)
  returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.student_trainer_assignments a
    where a.student_id = student and a.trainer_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.task_questions enable row level security;
alter table public.task_question_followups enable row level security;
alter table public.task_submissions enable row level security;
alter table public.submission_answers enable row level security;
alter table public.task_review_comments enable row level security;

-- Questions + follow-ups: content — read by any authenticated, written by admin.
drop policy if exists task_questions_read on public.task_questions;
create policy task_questions_read on public.task_questions
  for select to authenticated using (true);
drop policy if exists task_questions_admin_write on public.task_questions;
create policy task_questions_admin_write on public.task_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists task_followups_read on public.task_question_followups;
create policy task_followups_read on public.task_question_followups
  for select to authenticated using (true);
drop policy if exists task_followups_admin_write on public.task_question_followups;
create policy task_followups_admin_write on public.task_question_followups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Submissions: the student owns theirs; staff (their trainer/admin) may read
-- and update status. Only the student inserts.
drop policy if exists task_submissions_select on public.task_submissions;
create policy task_submissions_select on public.task_submissions
  for select to authenticated
  using (student_id = auth.uid() or public.is_student_staff(student_id));

drop policy if exists task_submissions_insert on public.task_submissions;
create policy task_submissions_insert on public.task_submissions
  for insert to authenticated with check (student_id = auth.uid());

drop policy if exists task_submissions_update on public.task_submissions;
create policy task_submissions_update on public.task_submissions
  for update to authenticated
  using (student_id = auth.uid() or public.is_student_staff(student_id))
  with check (student_id = auth.uid() or public.is_student_staff(student_id));

-- Answers: readable by anyone who can access the submission; written only by
-- the owning student.
drop policy if exists submission_answers_select on public.submission_answers;
create policy submission_answers_select on public.submission_answers
  for select to authenticated using (public.can_access_submission(submission_id));

drop policy if exists submission_answers_write on public.submission_answers;
create policy submission_answers_write on public.submission_answers
  for all to authenticated
  using (
    exists (select 1 from public.task_submissions s
            where s.id = submission_id and s.student_id = auth.uid())
  )
  with check (
    exists (select 1 from public.task_submissions s
            where s.id = submission_id and s.student_id = auth.uid())
  );

-- Comments: student + trainer + admin read and post (author is themselves).
drop policy if exists task_comments_select on public.task_review_comments;
create policy task_comments_select on public.task_review_comments
  for select to authenticated using (public.can_access_submission(submission_id));

drop policy if exists task_comments_insert on public.task_review_comments;
create policy task_comments_insert on public.task_review_comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.can_access_submission(submission_id));

-- ---------------------------------------------------------------------------
-- Realtime for the comment thread (RLS applies to the stream).
-- ---------------------------------------------------------------------------
alter table public.task_review_comments replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'task_review_comments'
  ) then
    alter publication supabase_realtime add table public.task_review_comments;
  end if;
end $$;
