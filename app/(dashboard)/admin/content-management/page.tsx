import { CourseManager } from "@/components/admin/course-manager";
import { listCourses } from "@/lib/content/queries";

// Admin > Content Management
// The course list — the entry point to all content authoring. An admin creates
// a course here, then opens it to build its weeks, days, tasks and media (R2).
// Data is loaded from Supabase and mutated via Server Actions.
export default async function Page() {
  const courses = await listCourses();
  return <CourseManager courses={courses} />;
}
