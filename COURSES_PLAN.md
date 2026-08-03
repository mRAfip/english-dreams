# Multi-course content management — implementation plan

Today the app hosts exactly one programme: `content_weeks` is a flat 1..N list,
and a teaching day's global number is derived positionally as
`(week_number - 1) * 5 + weekday`. Every student walks that same list.

This plan introduces a **course** layer on top, without changing the shape of a
course: each course is still weeks → 5 teaching days + 2 weekend quizzes. Only
the container changes, plus the student→course assignment.

---

## Decisions I need from you

I've marked my recommendation for each. Say "go" and I'll build the
recommended set; tell me which to flip otherwise.

### 1. Enrollment model — **recommended: one course per student**

Each student is assigned exactly one course when created (admin can change it
later). Their learning path, quizzes, progress and certificate all belong to
that course. This matches "in student adding process we assign which course".

*Alternative:* multiple concurrent enrollments per student. That needs a course
switcher in the student UI and per-course progress/certificates on every
student and trainer screen — significantly more work. The schema below uses a
separate `student_enrollments`-style column that can be widened to a join table
later if you ever want this, so choosing "one course" now is not a dead end.

### 2. Existing curriculum data — **recommended: migrate into a default course**

The migration creates one course (default name **"Basic Course"**, admin can
rename) and attaches every existing week, day, asset, video part and quiz to
it. Existing students are enrolled in it. Nothing is lost, no student's progress
breaks.

*Alternative:* start clean — drop existing content and rebuild. Student progress
rows tied to those days go with them.

### 3. Leaderboard + certificate scoping — **recommended: scoped per course**

Leaderboards rank students within their own course (ranking a basic-course
student against an intermediate one isn't meaningful), and a certificate reads
as completion of a named course, awarded when that course's day count is met.

*Alternative:* keep boards global and mixed. Less work now, but the numbers
become hard to read once courses have different lengths.

---

## Database

### New table: `content_courses`

```
id           uuid pk
slug         text unique          -- url-safe, e.g. "basic", "intermediate"
title        text                 -- "Basic Course"
description  text default ''
level        text default ''      -- free-text label shown on cards
position     int                  -- ordering in the admin list
status       content_status       -- published / draft / empty
created_at, updated_at
```

RLS mirrors `content_weeks`: any authenticated user reads, only admins write.

### Changed: `content_weeks`

- add `course_id uuid not null references content_courses(id) on delete cascade`
- **drop** `unique (week_number)`, **add** `unique (course_id, week_number)
  deferrable initially deferred`
- index on `course_id`

Everything below `content_weeks` — `content_days`, `content_assets`,
`content_day_videos`, `content_quizzes`, `content_quiz_questions` — is unchanged.
They inherit their course through the week, and the existing cascades already do
the right thing when a course is deleted.

### Changed: student→course assignment

Add `course_id uuid references content_courses(id) on delete set null` to
`student_access` (already one row per student, already admin-managed, already
seeded on student creation — the natural home, no new table or new RLS surface).

Null means "not assigned yet": the student sees an empty learning path with a
"your course hasn't been assigned yet" state rather than a crash.

### Migration file: `0021_courses.sql`

1. create `content_courses`
2. insert the default course, but only if any `content_weeks` rows exist
3. add `course_id` to `content_weeks`, backfill it to the default course, then
   set it `not null`
4. swap the week-number unique constraint for the composite one
5. add `course_id` to `student_access`, backfill existing students to the
   default course
6. RLS policies + `touch_updated_at` trigger for the new table

The migration is idempotent in the same style as the existing ones
(`if not exists`, `drop policy if exists`).

---

## Day numbering — the one real design constraint

A day's number is currently global and positional across the whole programme.
With several courses, "Day 12" is ambiguous unless you also know the course.
The fix keeps the existing derivation but scopes it:

**A day number is 1..N *within its course*.** `(week_number - 1) * 5 + weekday`
is unchanged; it's just computed per course. So:

- Student routes stay exactly as they are — `/student/learning-path/12` means
  day 12 of *the student's own course*, resolved from their `course_id`. No
  student-facing URL changes at all.
- Admin routes gain a course segment, because an admin browses across courses:
  - `/admin/content-management` → course list (new landing screen)
  - `/admin/content-management/[courseSlug]` → the week rail (today's screen)
  - `/admin/content-management/[courseSlug]/[dayNumber]` → day detail
  - `/admin/content-management/[courseSlug]/quiz/[weekNumber]/[day]` → quiz builder
- `TOTAL_TEACHING_DAYS` (a hardcoded 60) stops being meaningful and is replaced
  by the course's own authored length. It is currently used as a route bound in
  the day page, and in `certificate/directory.ts` and two student components —
  all four switch to the course's real day count, which the journey already
  carries as `totalDays`.

### R2 object keys

`lib/r2/keys.ts` currently builds `content/week-03/day-12/video/...`. Two
courses would collide on identical paths. New layout:

```
content/<courseSlug>/week-03/day-12/video/<uuid>-<file>.mp4
content/<courseSlug>/week-03/day-12/thumbnails/<uuid>-<file>.jpg
```

Existing objects keep their current keys — keys are stored per row in the DB, so
old and new layouts coexist safely and nothing needs re-uploading.

---

## Server code

### `lib/content/` — the core of the change

- **`queries.ts`**: `getCurriculum()` → `getCurriculum(courseId)`; `getDay()` and
  `getAdminQuiz()` take a course id too. New `listCourses()` and
  `getCourseBySlug()`. The mapping functions are unchanged.
- **`actions.ts`**: every existing action that resolves a day or week
  (`resolveDayId`, `saveWeekEdits`, `createWeek`, `removeWeek`, `updateWeek`,
  the asset/video-part actions) gains a course scope, so week/day lookups filter
  by `course_id`. New actions: `createCourse`, `updateCourse`, `deleteCourse`,
  `setCourseStatus`, `reorderCourse`. Revalidation paths become course-scoped.
- **`curriculum.ts`**: the in-memory scaffold `buildCurriculum()` is dead code
  now that everything reads Supabase — I'll delete it and keep only the helpers
  still in use (`weekNumberForDay`, `publishedSlots`, `curriculumStats`,
  `findDay`, `dayEngagement`).

### `lib/student/`

- **`journey.ts`**: `loadJourney()` first reads the signed-in student's
  `course_id`, then loads that course's curriculum. Returns an "unassigned"
  journey (empty weeks, a flag) when they have no course.
- **`progress.ts`**: `buildJourney` already derives `totalDays`/`totalWeeks`
  from the data it's given, so it needs almost nothing — just dropping the
  re-export of the fixed 60/12 constants.
- **`manage.ts`**: `createStudent` and `updateStudent` accept `courseId` and
  write it to the `student_access` upsert they already perform.
- **`actions.ts`**, **`quiz-bank.ts`**: day/week lookups scoped to the student's
  course.

### `lib/tasks/`, `lib/trainer/`, `lib/leaderboard/`, `lib/certificate/`, `lib/quiz/`

All of these resolve days or weeks by number and therefore need the course in
scope. Concretely:

- `tasks/queries.ts` — `dayIdFor(dayNumber)` becomes course-aware; the three
  embedded selects that read `content_days → content_weeks` also pull the
  course so a trainer's queue can label which course a submission is from.
- `trainer/queries.ts`, `trainer/assigned.ts` — a trainer can have students in
  different courses, so per-student progress must be computed against *that
  student's* course, not one shared curriculum. This is the subtlest change in
  the whole piece; currently they load one curriculum and apply it to everyone.
- `leaderboard/*` — group and rank by course (per decision 3).
- `certificate/directory.ts` — completion measured against the student's own
  course length instead of the constant 60.
- `quiz/actions.ts` — week lookup scoped by course.

---

## UI

### Admin

- **New**: `/admin/content-management` becomes a course list — cards with title,
  level, week/day counts, published %, and Add / Edit / Delete. Delete warns
  that it removes all the course's content.
- **Moved**: the current week-rail screen (`content-manager.tsx`, 818 lines)
  moves under `/[courseSlug]`, gains a course header + breadcrumb, and threads
  `courseSlug` through the links and Server Action calls it makes. Its internals
  are otherwise untouched.
- `day-detail.tsx` and `quiz-builder.tsx` take the course through their props and
  use it for back-links and action calls.
- **Students screen**: the create/edit dialogs get a "Course" select alongside
  the existing "Trainer" select, and the directory table gains a Course column.
  Student detail shows the assigned course and lets an admin change it.

### Student

No structural change — the same learning path, quizzes and certificates, just
resolved through their assigned course. Two additions:

- the course title appears in the header of the learning path / home
- an "unassigned" empty state for students who have no course yet

### Trainer

Assigned-students list and review queue gain a course label, since a trainer can
now hold students from different courses.

---

## Risks / things worth flagging

1. **Changing a student's course.** Their `student_day_progress` rows point at
   `content_days` of the *old* course. My plan is to keep those rows (the FK is
   still valid) but ignore them for the new course, so progress restarts at day
   1. The alternative — deleting them on reassignment — silently destroys
   history. I'd keep them unless you say otherwise.
2. **Trainer screens are the fiddly part.** They currently assume one shared
   curriculum for all students; making them per-student-course is where a bug is
   most likely to hide. I'll go carefully there.
3. **`WEEKS_IN_PROGRAMME` / `TOTAL_TEACHING_DAYS`** are baked into two student
   components and the certificate rules. Once courses have different lengths,
   any leftover use of those constants shows a wrong denominator. I'll remove
   them entirely rather than leave them importable.

---

## Suggested order of work

1. Migration `0021_courses.sql` + `types/content.ts` course types
2. `lib/content/` queries + actions (course CRUD, course-scoped everything)
3. Admin course list screen + move the week rail under `/[courseSlug]`
4. Student assignment: `manage.ts` + the two admin dialogs + directory column
5. Student side: `journey.ts` course resolution + unassigned empty state
6. Trainer / leaderboard / certificate / tasks scoping
7. `r2/keys.ts` course-prefixed keys
8. Remove dead scaffold + the fixed 60/12 constants; typecheck and build

Steps 1–5 are the functional change; 6–8 are what keeps the rest of the app
honest afterwards.
