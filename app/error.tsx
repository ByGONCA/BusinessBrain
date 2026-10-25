"use client";

import * as React from "react";
import Link from "next/link";
import { Particle404Canvas } from "@/components/ui/particle-404-canvas";
import { AlertCircle, RotateCcw, RefreshCw, Home } from "lucide-react";

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  React.useEffect(() => {
    // Log unexpected runtime error safely without leaking secrets
    console.error("Root Application Error:", {
      message: error?.message,
      digest: error?.digest,
    });
  }, [error]);

  const errorMessage = error?.message || "An unexpected error occurred while processing this request.";

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#080607] bg-[radial-gradient(ellipse_80%_80%_at_60%_35%,rgba(90,14,20,0.22)_0%,rgba(8,6,7,0.96)_72%,#080607_100%)] text-foreground font-sans select-none selection:bg-[#ef4444]/25">
      {/* Interactive Particle Constellation Canvas */}
      <Particle404Canvas />

      {/* Responsive Content Overlay */}
      <div className="relative z-10 flex min-h-screen w-full flex-col justify-between p-6 sm:p-12 md:p-16 lg:p-20 pointer-events-none">
        {/* MOBILE VIEW (Top Aligned) */}
        <div className="flex sm:hidden flex-col items-start pt-6 pointer-events-auto max-w-md animate-in fade-in duration-300">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#ef4444]">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Application Notice</span>
          </div>

          <h1 className="mt-2 text-2xl font-normal tracking-tight text-white leading-tight">
            Something went wrong while loading this view.
          </h1>

          {/* Clean Error Message Display */}
          <div className="mt-4 w-full rounded-xl border border-red-500/25 bg-[#140b0d]/90 p-3.5 text-xs font-mono text-red-200/90 backdrop-blur-md">
            <p className="line-clamp-3 select-text">{errorMessage}</p>
            {error?.digest && (
              <p className="mt-2 text-[10px] text-zinc-500 font-mono select-text">Digest: {error.digest}</p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#ef4444] hover:bg-[#dc2626] active:scale-[0.98] text-white px-4 py-2 text-xs font-semibold transition-all duration-200 shadow-lg shadow-red-950/40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Try again</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#161112]/90 hover:bg-[#221618] active:scale-[0.98] text-[#f0ebea] hover:text-white px-4 py-2 text-xs font-medium border border-[#3c1c21]/80 hover:border-[#58222b] transition-all duration-200 backdrop-blur-md"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#161112]/90 hover:bg-[#221618] active:scale-[0.98] text-[#f0ebea] hover:text-white px-4 py-2 text-xs font-medium border border-[#3c1c21]/80 hover:border-[#58222b] transition-all duration-200 backdrop-blur-md"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Home</span>
            </Link>
          </div>
        </div>

        {/* Desktop flex spacer */}
        <div className="hidden sm:block" aria-hidden="true" />

        {/* DESKTOP VIEW (Lower-Left Aligned matching 404 art direction) */}
        <div className="hidden sm:flex flex-col items-start mt-auto pointer-events-auto max-w-xl lg:max-w-2xl animate-in fade-in duration-300">
          <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#ef4444]">
            <AlertCircle className="h-4 w-4" />
            <span>Application Notice</span>
          </div>

          <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-white leading-[1.15]">
            Something went wrong while loading this view.
          </h1>

          {/* Clean Error Detail Container */}
          <div className="mt-5 w-full rounded-xl border border-red-500/25 bg-[#140b0d]/90 p-4 text-xs font-mono text-red-200/90 backdrop-blur-md shadow-xl select-text">
            <div className="text-[11px] font-sans font-semibold text-red-400 mb-1">Error Details:</div>
            <p className="select-text leading-relaxed">{errorMessage}</p>
            {error?.digest && (
              <p className="mt-2 text-[10px] text-zinc-500 font-mono select-text">Digest Reference: {error.digest}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-7 flex items-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ef4444] hover:bg-[#dc2626] active:scale-[0.98] text-white px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 shadow-lg shadow-red-950/40 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Try again</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#161112]/90 hover:bg-[#221618] active:scale-[0.98] text-[#f0ebea] hover:text-white px-5 py-2.5 text-xs sm:text-sm font-medium border border-[#3c1c21]/80 hover:border-[#58222b] transition-all duration-200 backdrop-blur-md shadow-lg hover:shadow-red-950/20 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh page</span>
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#161112]/90 hover:bg-[#221618] active:scale-[0.98] text-[#f0ebea] hover:text-white px-5 py-2.5 text-xs sm:text-sm font-medium border border-[#3c1c21]/80 hover:border-[#58222b] transition-all duration-200 backdrop-blur-md shadow-lg hover:shadow-red-950/20"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Back to home</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
