-- 0001_profiles_and_roles.sql
-- Profiles + role catalogue + user↔role relation, with RLS.
-- Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, auto-created by trigger below.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- user_roles: catalogue of the three roles. Lookup table, not per-user rows.
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (name in ('admin', 'trainer', 'student')),
  label       text not null,
  created_at  timestamptz not null default now()
);

insert into public.user_roles (name, label) values
  ('admin',   'Admin'),
  ('trainer', 'Trainer'),
  ('student', 'Student')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- user_role_assignments: the relation table linking an auth user to a role.
-- ---------------------------------------------------------------------------
create table if not exists public.user_role_assignments (
  user_id      uuid not null references auth.users (id) on delete cascade,
  role_id      uuid not null references public.user_roles (id) on delete restrict,
  assigned_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists user_role_assignments_role_id_idx
  on public.user_role_assignments (role_id);

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so RLS policies can call them without recursing
-- into the very table the policy is protecting.
-- ---------------------------------------------------------------------------
create or replace function public.has_role(check_user_id uuid, role_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_role_assignments a
    join public.user_roles r on r.id = a.role_id
    where a.user_id = check_user_id
      and r.name = role_name
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(auth.uid(), 'admin');
$$;

-- Auto-create a profile row whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.user_roles            enable row level security;
alter table public.user_role_assignments enable row level security;

-- profiles: you can read/update your own; admins can do anything.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- user_roles: readable by any signed-in user, writable by nobody (fixed set).
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (true);

-- user_role_assignments: you can see your own; only admins assign roles.
drop policy if exists ura_select_own on public.user_role_assignments;
create policy ura_select_own on public.user_role_assignments
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists ura_admin_write on public.user_role_assignments;
create policy ura_admin_write on public.user_role_assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
