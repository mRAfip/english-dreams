-- 0010_student_access.sql
-- Per-student access + fee state. One row per student (student_id is the primary
-- key). `access_enabled` is the admin's temporary on/off switch (the gate);
-- `fee_status` is an informational label the admin maintains alongside it.
--
-- A MISSING row means access is enabled — so existing students are never locked
-- out and no backfill is needed. Run in the Supabase SQL editor (or `supabase db push`).

create table if not exists public.student_access (
  student_id     uuid primary key references auth.users (id) on delete cascade,
  access_enabled boolean not null default true,
  fee_status     text not null default 'unpaid'
                   check (fee_status in ('paid', 'unpaid', 'waived')),
  note           text,
  -- Who last changed this. Nullable + set null so removing an admin never blocks.
  updated_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Keep updated_at honest (reuses public.touch_updated_at from 0001).
drop trigger if exists student_access_touch on public.student_access;
create trigger student_access_touch
  before update on public.student_access
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: admins manage; a student may read their own access row (so the app can
-- gate them). Trainers are not granted read here.
-- ---------------------------------------------------------------------------
alter table public.student_access enable row level security;

drop policy if exists sa_select on public.student_access;
create policy sa_select on public.student_access
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists sa_admin_write on public.student_access;
create policy sa_admin_write on public.student_access
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
