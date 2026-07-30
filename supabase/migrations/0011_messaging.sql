-- 0011_messaging.sql
-- Direct-message inbox between admin / trainer / student. Every thread is 1:1
-- (exactly two participants). WHO may talk to whom is business logic enforced in
-- the server action that creates a conversation (lib/inbox) — see canMessage;
-- RLS here only guarantees you can read/post in conversations you belong to.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  -- Canonical "least:greatest" of the two user ids — keeps a pair to one thread.
  pair_key        text not null unique,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  -- Everything the user has sent-or-seen up to this time is "read".
  last_read_at    timestamptz,
  created_at      timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_participants_user_idx
  on public.conversation_participants (user_id);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  -- Nullable so removing a user doesn't wipe the thread's history.
  sender_id       uuid references auth.users (id) on delete set null,
  body            text not null,
  created_at      timestamptz not null default now(),
  -- Soft delete: set (not row removal) so "message deleted" can render.
  deleted_at      timestamptz
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Helpers + triggers
-- ---------------------------------------------------------------------------

-- Membership test used by every policy. SECURITY DEFINER so it reads the
-- participants table without recursing into that table's own RLS.
create or replace function public.is_conversation_member(conv uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_participants p
    where p.conversation_id = conv
      and p.user_id = auth.uid()
  );
$$;

-- Keep conversations.last_message_at fresh for list ordering.
create or replace function public.bump_conversation_last_message()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_bump_conversation on public.messages;
create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_last_message();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Conversations: members and admins may read. Creation happens through the
-- service-role client after the app validates the pairing, so no client insert.
drop policy if exists conv_select on public.conversations;
create policy conv_select on public.conversations
  for select to authenticated
  using (public.is_conversation_member(id) or public.is_admin());

-- Participants: a member sees both rows of their own threads; admins see all.
-- A user may update their OWN row (to advance last_read_at).
drop policy if exists cp_select on public.conversation_participants;
create policy cp_select on public.conversation_participants
  for select to authenticated
  using (public.is_conversation_member(conversation_id) or public.is_admin());

drop policy if exists cp_update_own on public.conversation_participants;
create policy cp_update_own on public.conversation_participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Messages: members/admins read; a member posts as themselves; the sender (or an
-- admin) may edit — used only to set deleted_at (soft delete).
drop policy if exists msg_select on public.messages;
create policy msg_select on public.messages
  for select to authenticated
  using (public.is_conversation_member(conversation_id) or public.is_admin());

drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id)
  );

drop policy if exists msg_update on public.messages;
create policy msg_update on public.messages
  for update to authenticated
  using (sender_id = auth.uid() or public.is_admin())
  with check (sender_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Realtime: stream message inserts/updates to the authenticated client (RLS is
-- applied to the stream, so a user only receives messages in their own threads).
-- FULL replica identity so UPDATE (soft-delete) events carry the row and the
-- conversation_id filter works.
-- ---------------------------------------------------------------------------
alter table public.messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
