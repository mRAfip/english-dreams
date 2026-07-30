-- 0019_notifications.sql
-- Creates the notifications table for real-time notifications, enabling
-- RLS policies and triggers to automatically notify recipients of new messages.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  body        text not null,
  link        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table public.notifications enable row level security;

-- Index for fast user queries
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- Policies
drop policy if exists select_notifications on public.notifications;
create policy select_notifications on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists update_notifications on public.notifications;
create policy update_notifications on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Trigger to automatically create a notification when a message is inserted.
create or replace function public.notify_on_new_message()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_recipient_id uuid;
  v_sender_name text;
begin
  -- Find the recipient (the other participant in the conversation)
  select user_id into v_recipient_id
  from public.conversation_participants
  where conversation_id = new.conversation_id
    and user_id != new.sender_id
  limit 1;

  -- Find the sender's name
  select full_name into v_sender_name
  from public.profiles
  where id = new.sender_id;

  if v_recipient_id is not null then
    insert into public.notifications (user_id, title, body, link)
    values (
      v_recipient_id,
      coalesce(v_sender_name, 'New Message'),
      case 
        when length(new.body) > 60 then left(new.body, 57) || '...'
        else new.body
      end,
      '/inbox/u/' || new.sender_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists messages_notify_trigger on public.messages;
create trigger messages_notify_trigger
  after insert on public.messages
  for each row execute function public.notify_on_new_message();
