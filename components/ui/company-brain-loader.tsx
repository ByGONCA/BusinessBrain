"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { KogSyncLogo } from "@/components/brand/kogsync-logo";

export interface KogSyncLoaderProps {
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
   * Whether to display the KogSync logo and wordmark.
   * @default true
   */
  showBrand?: boolean;
  /**
   * Additional custom CSS classes for the container.
   */
  className?: string;
}

export type BusinessBrainLoaderProps = KogSyncLoaderProps;
export type CompanyBrainLoaderProps = KogSyncLoaderProps;

export function KogSyncLoader({
  fullScreen = true,
  text,
  showBrand = true,
  className,
}: KogSyncLoaderProps) {
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
        {/* Animated Brand Network Icon */}
        <div className="relative flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <svg
              className="h-10 w-10 animate-spin text-blue-500/40 motion-reduce:animate-none absolute -inset-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
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
            <KogSyncLogo variant="icon" size="sm" className="relative z-10 transition-transform duration-300" priority />
          </div>
        </div>

        {showBrand && (
          <div className="mt-3.5 flex items-center gap-1.5">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              KogSync
            </span>
          </div>
        )}

        {/* Optional Contextual Status Label */}
        {text && (
          <span className="mt-2 text-xs font-medium text-muted-foreground">
            {text}
          </span>
        )}

        {/* Accessible Screen Reader Announcer */}
        <span className="sr-only">{statusText}</span>
      </div>
    </div>
  );
}

// Backward-compatible aliases
export const BusinessBrainLoader = KogSyncLoader;
export const CompanyBrainLoader = KogSyncLoader;

