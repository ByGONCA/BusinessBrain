export default function PageLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pt-6 animate-pulse">
      {/* Top breadcrumb placeholder */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-3 w-3 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>

      {/* Header icon and title placeholder */}
      <div className="space-y-3 pt-4">
        <div className="h-10 w-10 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        <div className="h-9 w-64 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
      </div>

      {/* Block placeholders */}
      <div className="space-y-3 pt-6">
        <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-4 w-5/6 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-4 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>
    </div>
  );
}
