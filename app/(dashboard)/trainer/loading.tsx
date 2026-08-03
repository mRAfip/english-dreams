import { Skeleton } from "@/components/ui/skeleton";

export default function TrainerLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-2 border-b border-border pb-6">
        <Skeleton className="h-7 sm:h-8 w-48 sm:w-64 rounded-lg" />
        <Skeleton className="h-4 w-32 sm:w-44 rounded-md" />
      </div>

      {/* Stats Cards Row Skeleton */}
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

      {/* Content Areas Skeleton */}
      <div className="grid gap-6 lg:grid-cols-3 mt-2">
        {/* Left Side: Review Queue Skeleton */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32 sm:w-40 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center py-3 border-b border-border/40 last:border-0 gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                  <Skeleton className="size-8 sm:size-9 rounded-full shrink-0" />
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-20 sm:w-28 shrink-0" />
                      <Skeleton className="h-4 w-12 sm:w-16 shrink-0" />
                    </div>
                    <Skeleton className="h-3.5 w-2/3" />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Skeleton className="h-5 w-16 sm:w-20 rounded-full" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Attention Rail Skeleton */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-24 sm:w-28 rounded-md" />
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 sm:size-9 rounded-full shrink-0" />
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="flex justify-between items-baseline gap-2">
                    <Skeleton className="h-4 w-20 sm:w-24 truncate" />
                    <Skeleton className="h-3.5 w-10 shrink-0" />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3.5 w-16 rounded-full shrink-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
