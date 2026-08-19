-- 0028_branding_banner.sql
-- Stores the active promotional or branding banner key and URL.
-- Accessible by students/trainers for reading, and manageable by admins.

create table if not exists public.branding (
  id uuid primary key default gen_random_uuid(),
  banner_key text not null,
  banner_url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.branding enable row level security;

-- Policies
create policy "Admins have full access to branding"
  on public.branding
  for all
  using (public.is_admin());

create policy "Anyone authenticated can view branding"
  on public.branding
  for select
  using (auth.role() = 'authenticated');
