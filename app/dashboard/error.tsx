"use client";

import * as React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  React.useEffect(() => {
    console.error("Dashboard Canvas Error:", {
      message: error?.message,
      digest: error?.digest,
    });
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8 min-h-[50vh]">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-lg text-center animate-in fade-in duration-150">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
        </div>

        <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Unable to display this view
        </h2>
        <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          A temporary network or server interruption occurred. You can retry safely without losing your workspace state.
        </p>

        {error?.digest && (
          <div className="mt-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 p-2 text-left">
            <span className="text-[11px] font-mono text-zinc-500">
              Ref: {error.digest}
            </span>
          </div>
        )}

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reload View
          </button>
        </div>
      </div>
    </div>
  );
}
