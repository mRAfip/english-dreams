-- 0009_student_trainer.sql
-- Which trainer is responsible for each student. One trainer per student (the
-- student_id is the primary key), set when the student is created and reassignable
-- later. Run in the Supabase SQL editor (or `supabase db push`).

create table if not exists public.student_trainer_assignments (
  student_id   uuid primary key references auth.users (id) on delete cascade,
  -- Nullable so a student can be unassigned, and so deleting a trainer clears
  -- the link rather than blocking the delete.
  trainer_id   uuid references auth.users (id) on delete set null,
  assigned_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists student_trainer_assignments_trainer_id_idx
  on public.student_trainer_assignments (trainer_id);

-- Keep updated_at honest (reuses public.touch_updated_at from 0001).
drop trigger if exists student_trainer_assignments_touch
  on public.student_trainer_assignments;
create trigger student_trainer_assignments_touch
  before update on public.student_trainer_assignments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: admins manage; a student sees their own link; a trainer sees the
-- students assigned to them.
-- ---------------------------------------------------------------------------
alter table public.student_trainer_assignments enable row level security;

drop policy if exists sta_select on public.student_trainer_assignments;
create policy sta_select on public.student_trainer_assignments
  for select to authenticated
  using (
    student_id = auth.uid()
    or trainer_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists sta_admin_write on public.student_trainer_assignments;
create policy sta_admin_write on public.student_trainer_assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
