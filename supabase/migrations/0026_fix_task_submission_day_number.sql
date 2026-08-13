-- 0026_fix_task_submission_day_number.sql
-- content_days stores only its weekday. The student-facing day number is
-- derived from the related week's position, so task submission notifications
-- must follow task_submissions.day_id -> content_days -> content_weeks.

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
  -- Notify for a new submission and when a trainer-requested redo is
  -- resubmitted. Status changes to approved/redo do not notify the trainer.
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status != 'submitted') then
    select p.full_name
      into v_student_name
      from public.profiles p
     where p.id = new.student_id;

    select ((w.week_number - 1) * 5 + d.weekday)
      into v_day_number
      from public.content_days d
      join public.content_weeks w on w.id = d.week_id
     where d.id = new.day_id;

    select a.trainer_id
      into v_trainer_id
      from public.student_trainer_assignments a
     where a.student_id = new.student_id;

    if v_trainer_id is not null then
      insert into public.notifications (user_id, title, body, link)
      values (
        v_trainer_id,
        'Task submitted: Day ' || v_day_number || ' 📝',
        coalesce(v_student_name, 'A student') ||
          ' has submitted their homework task for Day ' || v_day_number || '.',
        '/trainer/review-tasks/' || new.id
      );
    end if;
  end if;

  return new;
end;
$$;
