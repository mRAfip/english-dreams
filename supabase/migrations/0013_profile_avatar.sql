-- 0013_profile_avatar.sql
-- Profile photos live in Cloudflare R2 (a private bucket). We store the R2
-- object KEY here; the app serves the image through /api/avatar/<userId>, which
-- redirects to a fresh presigned URL each load — so nothing expires and the
-- bucket stays private. `avatar_url` continues to hold the (stable) app URL that
-- every <img> across the app points at.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

alter table public.profiles
  add column if not exists avatar_key text;
