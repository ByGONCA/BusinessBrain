import * as React from "react";
import { cn } from "@/lib/utils";

interface PageIconProps {
  icon?: string | null;
  className?: string;
  imgClassName?: string;
  fallback?: string;
}

/**
 * Universal Page Icon renderer
 * Handles both Unicode emojis and custom uploaded image URLs / data URIs.
 */
export function PageIcon({
  icon,
  className,
  imgClassName,
  fallback = "📄",
}: PageIconProps) {
  const value = icon || fallback;

  if (
    value.startsWith("data:image/") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:")
  ) {
    return (
      <img
        src={value}
        alt="Page icon"
        className={cn("h-4 w-4 rounded object-cover shrink-0 select-none", imgClassName)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center leading-none shrink-0 select-none",
        className
      )}
    >
      {value}
    </span>
  );
}
