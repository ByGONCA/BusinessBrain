"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, RefreshCw, LayoutDashboard } from "lucide-react";

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  React.useEffect(() => {
    // Log unexpected runtime error safely to console for debugging without leaking technical internals to the user UI
    console.error("Root Application Error:", {
      message: error?.message,
      digest: error?.digest,
    });
  }, [error]);

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-6 sm:p-10 bg-[#101114] bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(59,130,246,0.06)_0%,rgba(16,17,20,0.98)_100%)] text-foreground font-sans select-none">
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/[0.06] bg-[#17181D]/90 p-8 sm:p-10 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 text-center">
        {/* Subtle Icon Badge */}
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-sm">
          <AlertCircle className="h-6 w-6" />
        </div>

        {/* Category Label */}
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-400">
          System Notice
        </span>

        {/* Reassuring Main Heading */}
        <h1 className="mt-2.5 text-2xl sm:text-3xl font-bold tracking-tight text-white leading-snug">
          Something went wrong while loading this view.
        </h1>

        {/* Clean, Non-Technical User-Facing Reassurance */}
        <p className="mt-3 text-sm text-[#A0A2AB] leading-relaxed max-w-md mx-auto">
          A temporary interruption occurred while processing your request. Your workspace data, documents, and settings are completely safe.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-150 shadow-md shadow-blue-950/40 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Try again</span>
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#202228] hover:bg-[#282A32] active:scale-[0.98] text-[#F2F2F4] hover:text-white px-5 py-2.5 text-xs sm:text-sm font-medium border border-white/[0.06] hover:border-white/[0.12] transition-all duration-150 cursor-pointer shadow-xs"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh page</span>
          </button>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#202228] hover:bg-[#282A32] active:scale-[0.98] text-[#F2F2F4] hover:text-white px-5 py-2.5 text-xs sm:text-sm font-medium border border-white/[0.06] hover:border-white/[0.12] transition-all duration-150 shadow-xs"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
        </div>

        {/* Subtle, non-intrusive digest reference for support tickets */}
        {error?.digest && (
          <p className="mt-6 text-[11px] text-zinc-500 font-mono">
            Reference: #{error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
