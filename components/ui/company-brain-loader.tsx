"use client";

import * as React from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CompanyBrainLoaderProps {
  /**
   * If true, expands to cover the available viewport (min-h-screen).
   * If false, fills the parent container (e.g. inside dashboard main content).
   * @default true
   */
  fullScreen?: boolean;
  /**
   * Status label displayed below the brand icon.
   * Product standard is "Loading...".
   * Kept configurable for future asynchronous operations (e.g., AI analysis, document indexing).
   * @default "Loading..."
   */
  text?: string;
  /**
   * Whether to display the Company Brain logo and wordmark.
   * @default true
   */
  showBrand?: boolean;
  /**
   * Additional custom CSS classes for the container.
   */
  className?: string;
}

export function CompanyBrainLoader({
  fullScreen = true,
  text = "Loading...",
  showBrand = true,
  className,
}: CompanyBrainLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center text-slate-100",
        fullScreen
          ? "min-h-screen w-full bg-slate-950 px-4"
          : "h-full min-h-[360px] w-full flex-1 p-8",
        className
      )}
    >
      <div className="flex flex-col items-center text-center">
        {showBrand && (
          <div className="flex flex-col items-center">
            {/* Branded Logo Mark */}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            {/* Wordmark */}
            <span className="mt-3 text-sm font-semibold tracking-tight text-white">
              Company Brain
            </span>
          </div>
        )}

        {/* Subtle Animated Indicator & Status Label */}
        <div className={cn("flex items-center gap-2", showBrand ? "mt-4" : "")}>
          <Loader2 className="h-4 w-4 animate-spin text-blue-500 motion-reduce:animate-none" />
          <span className="text-xs font-medium text-slate-400">
            {text}
          </span>
        </div>

        {/* Accessible Screen Reader Announcer */}
        <span className="sr-only">{text}</span>
      </div>
    </div>
  );
}
