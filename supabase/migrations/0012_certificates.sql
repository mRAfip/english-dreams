-- 0012_certificates.sql
-- Completion certificates. One issued document per student (student_id is
-- unique). The file itself lives in Cloudflare R2; this row stores the object
-- key plus who issued it and when. Run in the Supabase SQL editor (or
-- `supabase db push`).

create table if not exists public.certificates (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null unique references auth.users (id) on delete cascade,
  r2_key       text not null,
  file_name    text,
  content_type text,
  size_bytes   bigint,
  issued_by    uuid references auth.users (id) on delete set null,
  issued_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Keep updated_at honest (reuses public.touch_updated_at from 0001).
drop trigger if exists certificates_touch on public.certificates;
create trigger certificates_touch
  before update on public.certificates
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: a student reads their own certificate; admins manage all.
-- ---------------------------------------------------------------------------
alter table public.certificates enable row level security;

drop policy if exists certificates_select on public.certificates;
create policy certificates_select on public.certificates
  for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists certificates_admin_write on public.certificates;
create policy certificates_admin_write on public.certificates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
