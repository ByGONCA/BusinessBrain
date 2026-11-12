"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface KogSyncLogoProps {
  /**
   * Display variant:
   * - "icon": Just the KogSync mark / avatar
   * - "wordmark": KogSync icon + typography text
   * - "banner": The wide official brand banner
   */
  variant?: "icon" | "wordmark" | "banner";
  /**
   * Pre-defined size preset
   * @default "md"
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  /**
   * Additional custom CSS classes for the outer wrapper
   */
  className?: string;
  /**
   * Custom CSS classes for the wordmark text (if variant="wordmark")
   */
  textClassName?: string;
  /**
   * Custom CSS classes for the image itself
   */
  imageClassName?: string;
  /**
   * Priority loading for hero/header LCP
   */
  priority?: boolean;
  /**
   * Accessible alt text (defaults to "KogSync")
   */
  alt?: string;
}

const ICON_SIZES = {
  xs: "h-4 w-4",       // 16px (Chat inline, metadata)
  sm: "h-5 w-5",       // 20px (Compact rail, loader)
  md: "h-6 w-6",       // 24px (Header navbar, sidebar, main navigation)
  lg: "h-7 w-7",       // 28px (Cards, section headers)
  xl: "h-9 w-9",       // 36px (Auth hero card)
  "2xl": "h-12 w-12",  // 48px (Display hero)
};

const ICON_DIMENSIONS = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 36,
  "2xl": 48,
};

const BANNER_SIZES = {
  xs: "h-5 w-auto max-h-5",
  sm: "h-6 w-auto max-h-6",
  md: "h-7 w-auto max-h-7",
  lg: "h-9 w-auto max-h-9",
  xl: "h-12 w-auto max-h-12",
  "2xl": "h-16 w-auto max-h-16",
};

export function KogSyncLogo({
  variant = "wordmark",
  size = "md",
  className,
  textClassName,
  imageClassName,
  priority = false,
  alt = "KogSync",
}: KogSyncLogoProps) {
  // Variant: Wide Banner
  if (variant === "banner") {
    return (
      <div className={cn("relative inline-flex items-center select-none", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/KogSyncLogo/KogSync_banner_trimmed.png"
          alt={alt}
          className={cn(
            BANNER_SIZES[size],
            "object-contain select-none transition-all duration-200 dark:invert",
            imageClassName
          )}
          loading={priority ? "eager" : "lazy"}
        />
      </div>
    );
  }

  // Variant: Icon Only
  if (variant === "icon") {
    const dim = ICON_DIMENSIONS[size];
    return (
      <div
        className={cn(
          "relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden rounded-lg transition-transform duration-200",
          ICON_SIZES[size],
          className
        )}
        style={{ width: dim, height: dim, minWidth: dim, minHeight: dim }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/KogSyncLogo/KogSync_mark.png"
          alt={alt}
          width={dim}
          height={dim}
          className={cn(
            "h-full w-full object-contain select-none transition-all duration-200 dark:invert",
            imageClassName
          )}
          style={{ width: dim, height: dim, maxWidth: dim, maxHeight: dim }}
          loading={priority ? "eager" : "lazy"}
        />
      </div>
    );
  }

  // Variant: Wordmark (Icon + Typography)
  const dim = ICON_DIMENSIONS[size];
  return (
    <div className={cn("inline-flex items-center gap-2 select-none shrink-0", className)}>
      <div
        className={cn(
          "relative inline-flex items-center justify-center shrink-0 overflow-hidden rounded-lg",
          ICON_SIZES[size]
        )}
        style={{ width: dim, height: dim, minWidth: dim, minHeight: dim }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/KogSyncLogo/KogSync_mark.png"
          alt=""
          width={dim}
          height={dim}
          className={cn(
            "h-full w-full object-contain select-none transition-all duration-200 dark:invert",
            imageClassName
          )}
          style={{ width: dim, height: dim, maxWidth: dim, maxHeight: dim }}
          loading={priority ? "eager" : "lazy"}
        />
      </div>
      <span
        className={cn(
          "font-semibold tracking-tight text-foreground select-none leading-none",
          size === "xs" && "text-xs",
          size === "sm" && "text-sm",
          size === "md" && "text-[15px]",
          size === "lg" && "text-base",
          size === "xl" && "text-lg font-bold",
          size === "2xl" && "text-xl font-bold",
          textClassName
        )}
      >
        KogSync
      </span>
    </div>
  );
}

// Default export as well for flexibility
export default KogSyncLogo;

