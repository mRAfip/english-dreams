import { Skeleton } from "@/components/ui/skeleton";

export default function StudentLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 animate-pulse">
      {/* Header Greeting Skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-32 rounded-md" />
      </div>

      {/* ProgressHero Skeleton */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex justify-between items-center mt-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>

      {/* Class Week Selection Row Skeleton */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </div>
        {/* Week Day Pills */}
        <div className="grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-border">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="size-6 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Workspace List Skeleton */}
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
              <Skeleton className="h-5 w-48 mt-1" />
              <div className="rounded-xl bg-secondary/35 p-3 flex flex-col gap-2 border border-border/10">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
              <div className="flex justify-between items-center border-t border-border/30 pt-3 mt-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
