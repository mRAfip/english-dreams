import { createClient } from "@/lib/supabase/server";
import { getCourseById } from "@/lib/content/queries";
import { getCurrentUser } from "@/lib/auth/guards";
import type { Course } from "@/types/content";

// Which course a student is on. Every student-facing read starts here: day
// numbers, week numbers and quiz ids only mean something inside one course.
//
// The assignment lives on student_access.course_id (see 0021_courses.sql) —
// the row an admin already maintains for access and fees.
//
// NULL is a normal state, not an error: an admin can create a student before
// deciding their course. Callers get `null` and render the "no course yet"
// empty state rather than crashing or silently showing another course's work.

/** The course id assigned to a student, or null when they have none. */
export async function courseIdForStudent(
  studentId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_access")
    .select("course_id")
    .eq("student_id", studentId)
    .maybeSingle();
  return (data as { course_id: string | null } | null)?.course_id ?? null;
}

/** The signed-in student's course id, or null (not signed in / unassigned). */
export async function currentCourseId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return courseIdForStudent(user.id);
}

/** The signed-in student's course in full, or null. */
export async function currentCourse(): Promise<Course | null> {
  const courseId = await currentCourseId();
  return courseId ? getCourseById(courseId) : null;
}

/**
 * The assigned course for each of a set of students, keyed by student id.
 * One query for the whole set — used by the trainer screens, where each
 * student's progress must be measured against their OWN course.
 */
export async function courseIdsForStudents(
  studentIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (studentIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("student_access")
    .select("student_id, course_id")
    .in("student_id", studentIds);

  for (const row of (data ?? []) as {
    student_id: string;
    course_id: string | null;
  }[]) {
    map.set(row.student_id, row.course_id);
  }
  return map;
}
