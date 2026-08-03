"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  ChevronRight,
  Globe,
  LibraryBig,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCourse,
  deleteCourse,
  setCourseStatus,
  updateCourse,
} from "@/lib/content/actions";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/content/status";
import type { CourseSummary } from "@/types/content";

// Admin > Content — the course list, the entry point to all content authoring.
//
// A course is the container an admin creates BEFORE authoring anything: pick a
// name and level here, then open it to build its weeks. The shape inside a
// course never varies (5 teaching days + 2 weekend papers per week), so this
// screen only deals with the courses themselves.

export function CourseManager({ courses }: { courses: CourseSummary[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<CourseSummary | null>(null);
  const [removing, setRemoving] = React.useState<CourseSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function togglePublished(course: CourseSummary) {
    startTransition(async () => {
      await setCourseStatus({
        slug: course.slug,
        status: course.status === "published" ? "draft" : "published",
      });
      router.refresh();
    });
  }

  function doDelete() {
    if (!removing) return;
    const slug = removing.slug;
    startTransition(async () => {
      const result = await deleteCourse(slug);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setRemoving(null);
      router.refresh();
    });
  }

  const totalStudents = courses.reduce((sum, c) => sum + c.studentCount, 0);

  return (
    <div>
      <header className="flex flex-row items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="truncate font-display text-xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Courses
          </h1>
          <p className="truncate text-xs text-body sm:text-sm">
            {courses.length} {courses.length === 1 ? "course" : "courses"} ·{" "}
            {totalStudents} {totalStudents === 1 ? "student" : "students"}{" "}
            enrolled
          </p>
        </div>

        <Button
          onClick={() => setAdding(true)}
          disabled={pending}
          className="h-9 shrink-0 rounded-lg px-3 text-xs sm:h-11 sm:rounded-xl sm:px-6 sm:text-sm"
        >
          <Plus />
          Add course
        </Button>
      </header>

      {error ? (
        <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {courses.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-secondary">
            <LibraryBig className="size-5 text-mute" />
          </span>
          <p className="max-w-sm text-sm text-mute">
            No courses yet. Create one — Basic, Intermediate, whatever you
            teach — then build its weeks inside it. Every course follows the same
            shape: 5 teaching days and 2 weekend papers per week.
          </p>
          <Button onClick={() => setAdding(true)}>
            <Plus />
            Add course
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              pending={pending}
              onEdit={() => setEditing(course)}
              onTogglePublished={() => togglePublished(course)}
              onRemove={() => {
                setError(null);
                setRemoving(course);
              }}
            />
          ))}
        </div>
      )}

      <CourseDialog
        open={adding}
        title="Add course"
        description="Name the course and give it a level. You'll build its weeks next."
        submitLabel="Create course"
        onClose={() => setAdding(false)}
        onSubmit={(values) =>
          startTransition(async () => {
            const result = await createCourse(values);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setError(null);
            setAdding(false);
            router.refresh();
          })
        }
      />

      <CourseDialog
        open={editing !== null}
        title="Edit course"
        description="Renaming a course changes its label only — its web address and uploaded files stay where they are."
        submitLabel="Save changes"
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={(values) => {
          const slug = editing?.slug;
          if (!slug) return;
          startTransition(async () => {
            const result = await updateCourse({ slug, ...values });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setError(null);
            setEditing(null);
            router.refresh();
          });
        }}
      />

      {/* Deleting a course destroys everything authored inside it, so the
          confirmation names what goes with it rather than asking vaguely. */}
      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {removing?.title}?</DialogTitle>
            <DialogDescription>
              This removes its {removing?.weekCount ?? 0} weeks, all uploaded
              videos and notes, every quiz, and the progress students recorded
              against it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={doDelete}
            >
              Delete course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CourseCard({
  course,
  pending,
  onEdit,
  onTogglePublished,
  onRemove,
}: {
  course: CourseSummary;
  pending: boolean;
  onEdit: () => void;
  onTogglePublished: () => void;
  onRemove: () => void;
}) {
  const published = course.status === "published";

  return (
    <article className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-pale">
            <LibraryBig className="size-4.5 text-ink-deep" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">
              {course.title}
            </div>
            <div className="truncate text-xs text-mute">
              {course.level || "No level set"}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Badge variant={STATUS_VARIANT[course.status]}>
            {STATUS_LABEL[course.status]}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${course.title} actions`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil />
                Edit course
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onTogglePublished} disabled={pending}>
                {published ? <Globe /> : <BadgeCheck />}
                {published ? "Unpublish" : "Publish"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onRemove}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
              >
                <Trash2 />
                Delete course
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {course.description ? (
        <p className="border-b border-border px-4 py-3 text-xs text-body">
          {course.description}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-4 text-xs text-mute">
          <span>
            {course.weekCount} {course.weekCount === 1 ? "week" : "weeks"} ·{" "}
            {course.dayCount} days
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3.5" />
            {course.studentCount}
          </span>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/content-management/${course.slug}`}>
            {course.weekCount > 0 ? "Open" : "Build content"}
            <ChevronRight />
          </Link>
        </Button>
      </div>
    </article>
  );
}

type CourseValues = { title: string; description: string; level: string };

function CourseDialog({
  open,
  title,
  description,
  submitLabel,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  initial?: CourseValues;
  onClose: () => void;
  onSubmit: (values: CourseValues) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            onSubmit({
              title: String(form.get("title") ?? ""),
              description: String(form.get("description") ?? ""),
              level: String(form.get("level") ?? ""),
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="course-title">Course name</Label>
              <Input
                id="course-title"
                name="title"
                required
                defaultValue={initial?.title ?? ""}
                placeholder="Basic Course"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="course-level">Level</Label>
              <Input
                id="course-level"
                name="level"
                defaultValue={initial?.level ?? ""}
                placeholder="Beginner"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="course-description">Description</Label>
              <Input
                id="course-description"
                name="description"
                defaultValue={initial?.description ?? ""}
                placeholder="Sounds, greetings, and everyday conversation"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
