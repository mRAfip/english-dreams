import { LibraryBig } from "lucide-react";

// Shown to a student whose admin hasn't put them on a course yet.
//
// This is a real, reachable state — an account can be created before the course
// is decided — so it gets an honest explanation rather than an empty page that
// reads like a broken app. Nothing here is actionable by the student: the fix is
// an admin assigning them a course, so the copy says exactly that and stops.

export function NoCourseAssigned({
  title = "Your course hasn't been set up yet",
}: {
  title?: string;
}) {
  return (
    <div className="mt-16 flex flex-col items-center gap-4 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-secondary">
        <LibraryBig className="size-5 text-mute" />
      </span>
      <h1 className="font-display text-xl font-extrabold tracking-tight text-ink">
        {title}
      </h1>
      <p className="max-w-sm text-sm text-mute">
        Your classes, notes and quizzes appear here as soon as your course is
        assigned. Nothing is missing on your side — message your trainer if this
        stays empty.
      </p>
    </div>
  );
}
