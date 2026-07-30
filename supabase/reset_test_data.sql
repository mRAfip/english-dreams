-- reset_test_data.sql — DESTRUCTIVE. Wipes everything except admin accounts.
--
-- Purpose: get a clean slate to test the app end-to-end. Keeps every user that
-- holds the 'admin' role (their auth account, profile and role assignment) and
-- deletes ALL other data — trainers, students, chats, progress, quiz attempts,
-- assignments, access flags and certificates.
--
-- This is NOT a migration — do not place it in the migrations folder. Run it by
-- hand in the Supabase SQL editor (service role, so RLS is bypassed). It runs in
-- a transaction: if anything fails, nothing is deleted.
--
-- This is a FULL wipe: the curriculum content (weeks / days / videos / notes /
-- quizzes) is cleared too. Only the admin login survives — rebuild everything
-- else through the app.

begin;

-- ---------------------------------------------------------------------------
-- SECTION 1 — user + app data (always runs)
-- ---------------------------------------------------------------------------

-- Messaging: deleting conversations cascades to participants and messages.
delete from public.messages;
delete from public.conversation_participants;
delete from public.conversations;

-- Certificates, access flags, trainer links.
delete from public.certificates;
delete from public.student_access;
delete from public.student_trainer_assignments;

-- Student learning data.
delete from public.student_quiz_attempts;
delete from public.student_day_progress;

-- Finally, every user that is NOT an admin. Deleting from auth.users cascades
-- to public.profiles and public.user_role_assignments (and GoTrue's own
-- sessions/identities), so those are cleaned up automatically.
delete from auth.users u
where not exists (
  select 1
  from public.user_role_assignments ura
  join public.user_roles r on r.id = ura.role_id
  where ura.user_id = u.id
    and r.name = 'admin'
);

-- ---------------------------------------------------------------------------
-- SECTION 2 — curriculum content
-- Deleting content_weeks cascades to content_days -> content_assets and to
-- content_quizzes -> content_quiz_questions, so this clears the whole programme.
-- ---------------------------------------------------------------------------
delete from public.content_weeks;

-- ---------------------------------------------------------------------------
-- Verify what remains before committing. Expect only your admin row(s).
-- ---------------------------------------------------------------------------
select u.id, u.email, p.full_name
from auth.users u
left join public.profiles p on p.id = u.id
order by u.email;

commit;
