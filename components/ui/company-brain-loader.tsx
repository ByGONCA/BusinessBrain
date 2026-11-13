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
        {/* Brand Icon with sleek spinning accent ring */}
        <div className="relative flex items-center justify-center">
          <div className="relative flex items-center justify-center p-3">
            <div
              className="absolute inset-0 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            <KogSyncLogo
              variant="icon"
              size="sm"
              className="relative z-10 transition-transform duration-300"
              priority
            />
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

