import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-row items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <Skeleton className="h-7 sm:h-8 w-44 sm:w-56 rounded-lg" />
          <Skeleton className="h-4 w-28 sm:w-36 rounded-md" />
        </div>
        <Skeleton className="h-9 sm:h-11 w-24 sm:w-32 rounded-lg sm:rounded-xl shrink-0" />
      </div>

      {/* Stats Cards Grid Skeleton */}
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex justify-between items-center gap-2">
              <Skeleton className="h-4 w-16 sm:w-20" />
              <Skeleton className="size-7 sm:size-8 rounded-full" />
            </div>
            <Skeleton className="h-8 w-12 sm:w-16 mt-1" />
            <Skeleton className="h-3 w-20 sm:w-24 mt-0.5" />
          </div>
        ))}
      </div>

      {/* Main Content Areas Skeleton */}
      <div className="grid gap-6 lg:grid-cols-3 mt-2">
        {/* Left Side: Table Skeleton */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Skeleton className="h-6 w-32 sm:w-40 rounded-md" />
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between items-center py-2.5 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <Skeleton className="size-8 sm:size-9 rounded-full" />
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-24 sm:w-32" />
                    <Skeleton className="h-3 w-36 sm:w-48" />
                  </div>
                </div>
                <Skeleton className="h-5 sm:h-6 w-16 sm:w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Progress Loads Skeleton */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-24 sm:w-28 rounded-md" />
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6 flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex justify-between items-baseline gap-2">
                  <Skeleton className="h-4 w-20 sm:w-24" />
                  <Skeleton className="h-3.5 w-6 sm:w-8" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-3 w-14 sm:w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
