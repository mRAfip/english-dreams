-- 0006_content.sql
-- Curriculum content tables: weeks, teaching days, and the R2-backed assets
-- (video + notes) attached to each day. Replaces the in-memory scaffold in
-- lib/content/curriculum.ts. Run in the Supabase SQL editor (or `supabase db push`).
--
-- Day numbering (the "Day n / 60" shown to students) is POSITIONAL, not stored:
-- a day's global number is (week_number - 1) * 5 + weekday, computed at read
-- time. That keeps inserts/removals cheap — only week_number shifts, never a
-- cascade of day rows. week_number's unique constraint is DEFERRABLE so a bulk
-- re-number after a delete doesn't trip a transient collision.

-- ---------------------------------------------------------------------------
-- Shared status enum (published / draft / not-started).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'content_status') then
    create type public.content_status as enum ('published', 'draft', 'empty');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- content_weeks: 1..N, ordered by week_number.
-- ---------------------------------------------------------------------------
create table if not exists public.content_weeks (
  id           uuid primary key default gen_random_uuid(),
  week_number  int  not null,
  title        text not null,
  focus        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint content_weeks_week_number_key
    unique (week_number) deferrable initially deferred
);

-- ---------------------------------------------------------------------------
-- content_days: 5 teaching days per week. Global day number is derived, so we
-- store only the intra-week weekday (1..5). The daily task lives here too.
-- ---------------------------------------------------------------------------
create table if not exists public.content_days (
  id           uuid primary key default gen_random_uuid(),
  week_id      uuid not null references public.content_weeks (id) on delete cascade,
  weekday      int  not null check (weekday between 1 and 5),
  title        text not null default '',
  task_title   text not null default '',
  task_prompt  text not null default '',
  task_status  public.content_status not null default 'empty',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (week_id, weekday)
);

create index if not exists content_days_week_id_idx
  on public.content_days (week_id);

-- ---------------------------------------------------------------------------
-- content_assets: one video and/or one notes file per day. r2_key is the
-- object key in the bucket; the file is served via a public URL or presigned
-- GET derived from that key (see lib/r2/presign.ts).
-- ---------------------------------------------------------------------------
create table if not exists public.content_assets (
  id            uuid primary key default gen_random_uuid(),
  day_id        uuid not null references public.content_days (id) on delete cascade,
  kind          text not null check (kind in ('video', 'notes')),
  r2_key        text not null,
  file_name     text,
  content_type  text,
  size_bytes    bigint,
  duration_min  int,
  status        public.content_status not null default 'draft',
  uploaded_by   uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- At most one active asset of each kind per day; replacing overwrites the row.
  unique (day_id, kind)
);

create index if not exists content_assets_day_id_idx
  on public.content_assets (day_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuses public.touch_updated_at from 0001).
-- ---------------------------------------------------------------------------
drop trigger if exists content_weeks_touch on public.content_weeks;
create trigger content_weeks_touch
  before update on public.content_weeks
  for each row execute function public.touch_updated_at();

drop trigger if exists content_days_touch on public.content_days;
create trigger content_days_touch
  before update on public.content_days
  for each row execute function public.touch_updated_at();

drop trigger if exists content_assets_touch on public.content_assets;
create trigger content_assets_touch
  before update on public.content_assets
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: any signed-in user may read the curriculum; only admins may write.
-- ---------------------------------------------------------------------------
alter table public.content_weeks  enable row level security;
alter table public.content_days   enable row level security;
alter table public.content_assets enable row level security;

drop policy if exists content_weeks_read on public.content_weeks;
create policy content_weeks_read on public.content_weeks
  for select to authenticated using (true);

drop policy if exists content_weeks_admin_write on public.content_weeks;
create policy content_weeks_admin_write on public.content_weeks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists content_days_read on public.content_days;
create policy content_days_read on public.content_days
  for select to authenticated using (true);

drop policy if exists content_days_admin_write on public.content_days;
create policy content_days_admin_write on public.content_days
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists content_assets_read on public.content_assets;
create policy content_assets_read on public.content_assets
  for select to authenticated using (true);

drop policy if exists content_assets_admin_write on public.content_assets;
create policy content_assets_admin_write on public.content_assets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- No seed data. The programme starts empty; admins build it up one week at a
-- time from /admin/content-management (each "Add week" inserts a week plus its
-- 5 empty teaching days). Nothing here is hardcoded.
