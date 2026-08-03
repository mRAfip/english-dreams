import { Skeleton } from "@/components/ui/skeleton";

export default function GeneralDashboardLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-row items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <Skeleton className="h-7 sm:h-8 w-36 sm:w-48 rounded-lg" />
          <Skeleton className="h-4 w-24 sm:w-32 rounded-md" />
        </div>
        <Skeleton className="h-9 sm:h-11 w-20 sm:w-28 rounded-lg sm:rounded-xl shrink-0" />
      </div>

      {/* Content Blocks Skeletons */}
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex justify-between items-center gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4.5 w-16 sm:w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="size-6 rounded-full" />
            </div>
            <Skeleton className="h-5 w-32 sm:w-48 mt-1" />
            <Skeleton className="h-3.5 w-full mt-0.5" />
            <Skeleton className="h-3.5 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
