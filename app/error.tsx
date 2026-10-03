"use client";

import * as React from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  React.useEffect(() => {
    // Log unexpected runtime error safely without exposing secrets
    console.error("Root Application Error:", {
      message: error?.message,
      digest: error?.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-xl text-center animate-in fade-in duration-150">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
          <AlertCircle className="h-6 w-6" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          A temporary error occurred while processing your request. You can try refreshing the page or returning to the dashboard.
        </p>

        {error?.digest && (
          <div className="mt-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 p-2 text-left">
            <span className="text-[11px] font-mono text-zinc-500">
              Error code: {error.digest}
            </span>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xs"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
          <a
            href="/dashboard"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
