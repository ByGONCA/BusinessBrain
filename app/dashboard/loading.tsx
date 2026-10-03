export default function DashboardLoading() {
  return (
    <div
      className="space-y-6 animate-pulse transition-opacity duration-150"
      aria-busy="true"
      aria-label="Loading workspace content"
    >
      {/* Page Header Skeleton */}
      <div className="space-y-2">
        <div className="h-6 w-44 rounded-md bg-muted/60" />
        <div className="h-3.5 w-72 rounded-md bg-muted/40" />
      </div>

      {/* Metric Cards Skeleton Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-border/50 bg-card/30 p-4 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-muted/60" />
              <div className="h-3.5 w-3.5 rounded bg-muted/40" />
            </div>
            <div className="h-6 w-10 rounded bg-muted/60" />
            <div className="h-2.5 w-28 rounded bg-muted/30" />
          </div>
        ))}
      </div>

      {/* Content Section Skeleton */}
      <div className="rounded-xl border border-border/50 bg-card/30 p-6 space-y-4">
        <div className="space-y-1.5">
          <div className="h-4 w-40 rounded bg-muted/60" />
          <div className="h-3 w-64 rounded bg-muted/40" />
        </div>
        <div className="pt-2 space-y-2.5">
          <div className="h-12 w-full rounded-lg bg-muted/20 border border-border/30" />
          <div className="h-12 w-full rounded-lg bg-muted/20 border border-border/30" />
          <div className="h-12 w-full rounded-lg bg-muted/20 border border-border/30" />
        </div>
      </div>
    </div>
  );
}
