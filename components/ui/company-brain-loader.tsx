"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

export interface BusinessBrainLoaderProps {
  /**
   * If true, expands to cover the available viewport (min-h-screen).
   * If false, fills the parent container (e.g. inside dashboard main content or card suspense).
   * @default true
   */
  fullScreen?: boolean;
  /**
   * Status label displayed below the brand icon.
   * If omitted, automatically uses the localized string from the active language dictionary.
   */
  text?: string;
  /**
   * Whether to display the BusinessBrain logo and wordmark.
   * @default true
   */
  showBrand?: boolean;
  /**
   * Additional custom CSS classes for the container.
   */
  className?: string;
}

export type CompanyBrainLoaderProps = BusinessBrainLoaderProps;

export function BusinessBrainLoader({
  fullScreen = true,
  text,
  showBrand = true,
  className,
}: BusinessBrainLoaderProps) {
  const { t } = useLanguage();
  const statusText = text ?? t?.common?.loading ?? "Loading...";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center bg-background text-foreground transition-colors duration-150 select-none",
        fullScreen
          ? "min-h-screen w-full px-4"
          : "h-full min-h-[260px] w-full flex-1 p-6",
        className
      )}
    >
      <div className="flex flex-col items-center justify-center text-center">
        {/* Animated Brand Network Icon Spinning Directly */}
        <div className="relative flex items-center justify-center">
          <svg
            className="h-8 w-8 animate-spin text-foreground motion-reduce:animate-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="12" cy="18" r="3" />
            <line x1="8.5" y1="7.5" x2="10" y2="15.5" />
            <line x1="15.5" y1="7.5" x2="14" y2="15.5" />
          </svg>
        </div>

        {/* Optional Contextual Status Label (only rendered if explicit text is provided) */}
        {text && (
          <span className="mt-3 text-xs font-medium text-muted-foreground">
            {text}
          </span>
        )}

        {/* Accessible Screen Reader Announcer */}
        <span className="sr-only">{statusText}</span>
      </div>
    </div>
  );
}

// Backward-compatible alias for existing imports
export const CompanyBrainLoader = BusinessBrainLoader;
