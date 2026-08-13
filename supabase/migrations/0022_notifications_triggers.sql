-- 0022_notifications_triggers.sql
-- Sets up triggers and cron reminders to support the core notifications system:
-- 1. Welcome notification upon user role assignment
-- 2. Unlock/New week unlocked notification after completing a weekly quiz assessment
-- 3. Daily activity reminder function to run on a scheduler
-- 4. Notification to the assigned trainer when a student submits their task

BEGIN;

-- ============================================================================
-- 1. Welcome Notification Trigger
-- ============================================================================
create or replace function public.notify_on_welcome()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_role_name text;
begin
  -- Resolve the role name
  select name into v_role_name
  from public.user_roles
  where id = new.role_id;

  if v_role_name = 'student' then
    insert into public.notifications (user_id, title, body, link)
    values (
      new.user_id,
      'Welcome to English Dreams! ✨',
      'Your 60-day English path is ready. Take your initial test or check your daily class to start!',
      '/student'
    );
  elsif v_role_name = 'trainer' then
    insert into public.notifications (user_id, title, body, link)
    values (
      new.user_id,
      'Welcome to English Dreams! 🎓',
      'You are now registered as a trainer. Check your Assigned Students or Task Review queue to begin.',
      '/trainer'
    );
  elsif v_role_name = 'admin' then
    insert into public.notifications (user_id, title, body, link)
    values (
      new.user_id,
      'Welcome to English Dreams! ⚙️',
      'You have admin access. You can now manage students, trainers, and create new courses.',
      '/admin'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists welcome_notify_trigger on public.user_role_assignments;
create trigger welcome_notify_trigger
  after insert on public.user_role_assignments
  for each row execute function public.notify_on_welcome();


-- ============================================================================
-- 2. New Week Started After Quiz Trigger
-- ============================================================================
create or replace function public.notify_on_quiz_completion()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_week_num int;
  v_kind text;
  v_next_week_num int;
begin
  -- Get the week number and quiz kind (saturday=practice, sunday=assessment)
  select w.week_number, q.kind into v_week_num, v_kind
  from public.content_quizzes q
  join public.content_weeks w on q.week_id = w.id
  where q.id = new.quiz_id;

  -- Only notify on Sunday assessment completion
  if v_kind = 'assessment' then
    v_next_week_num := v_week_num + 1;
    
    insert into public.notifications (user_id, title, body, link)
    values (
      new.user_id,
      'New week unlocked! 🚀',
      'Congratulations on completing Week ' || v_week_num || '! Week ' || v_next_week_num || ' is now open for you.',
      '/student'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists quiz_completion_notify_trigger on public.student_quiz_attempts;
create trigger quiz_completion_notify_trigger
  after insert on public.student_quiz_attempts
  for each row execute function public.notify_on_quiz_completion();


-- ============================================================================
-- 3. Trainer Notification on Student Task Submission Trigger
-- ============================================================================
create or replace function public.notify_trainer_on_task_submission()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_student_name text;
  v_trainer_id uuid;
  v_day_number int;
begin
  -- Only notify when a task is submitted (new insert or transition to submitted)
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status != 'submitted') then
    -- Find student's name
    select full_name into v_student_name
    from public.profiles
    where id = new.student_id;

    -- Find day number
    select day_number into v_day_number
    from public.content_days
    where id = new.day_id;

    -- Find assigned trainer
    select trainer_id into v_trainer_id
    from public.student_trainer_assignments
    where student_id = new.student_id;

    if v_trainer_id is not null then
      insert into public.notifications (user_id, title, body, link)
      values (
        v_trainer_id,
        'Task submitted: Day ' || v_day_number || ' 📝',
        coalesce(v_student_name, 'A student') || ' has submitted their homework task for Day ' || v_day_number || '.',
        '/trainer/review-tasks/' || new.id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists task_submission_notify_trigger on public.task_submissions;
create trigger task_submission_notify_trigger
  after insert or update on public.task_submissions
  for each row execute function public.notify_trainer_on_task_submission();


-- ============================================================================
-- 4. Daily Activity Reminder Function
-- ============================================================================
create or replace function public.check_and_send_reminders()
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  r_student record;
  v_active_day_id uuid;
  v_active_day_number int;
  v_task_completed boolean;
  v_video_watched boolean;
begin
  -- Loop through all students who have active access and an assigned course
  for r_student in
    select sa.student_id, sa.course_id, p.full_name
    from public.student_access sa
    join public.profiles p on sa.student_id = p.id
    where sa.access_enabled = true
      and sa.course_id is not null
  loop
    -- Find their first uncompleted day in the course
    select d.id, d.day_number into v_active_day_id, v_active_day_number
    from public.content_days d
    join public.content_weeks w on d.week_id = w.id
    where w.course_id = r_student.course_id
      and d.status = 'published'
      and not exists (
        select 1 
        from public.student_day_progress sdp
        where sdp.student_id = r_student.student_id
          and sdp.day_number = d.day_number
          and sdp.task_completed = true
      )
    order by d.day_number asc
    limit 1;

    -- If there is an active day they haven't completed task for
    if v_active_day_id is not null then
      -- Check if they watched the video or completed the task
      select task_completed, video_watched into v_task_completed, v_video_watched
      from public.student_day_progress
      where student_id = r_student.student_id
        and day_number = v_active_day_number;

      v_task_completed := coalesce(v_task_completed, false);
      v_video_watched := coalesce(v_video_watched, false);

      -- If they haven't completed the task or haven't watched the video
      if not v_task_completed or not v_video_watched then
        -- Send notification
        insert into public.notifications (user_id, title, body, link)
        values (
          r_student.student_id,
          'Daily reminder! ⏰',
          'You have uncompleted activities for Day ' || v_active_day_number || '. Watch the video and submit your task to keep your streak!',
          '/student'
        );
      end if;
    end if;
  end loop;
end;
$$;

COMMIT;
