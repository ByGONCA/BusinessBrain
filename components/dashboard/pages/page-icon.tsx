import * as React from "react";
import { cn } from "@/lib/utils";

interface PageIconProps {
  icon?: string | null;
  iconFileId?: string | null;
  pageId?: string | null;
  className?: string;
  imgClassName?: string;
  fallback?: string;
}

/**
 * Universal Page Icon renderer
 * Handles Unicode emojis, external URLs, and private uploaded icons via iconFileId / /api/pages/[id]/icon.
 * Guaranteed never to render raw system identifiers (e.g. "custom_id" or UUID strings) as text.
 */
export function PageIcon({
  icon,
  iconFileId,
  pageId,
  className,
  imgClassName,
  fallback = "📄",
}: PageIconProps) {
  const [loadError, setLoadError] = React.useState(false);

  // Reset load error if icon or pageId changes
  React.useEffect(() => {
    setLoadError(false);
  }, [icon, iconFileId, pageId]);

  const raw = (icon || "").trim();

  // Check if icon is a custom uploaded image pointer
  const isCustomImagePointer =
    Boolean(iconFileId) ||
    raw === "custom_id" ||
    raw.startsWith("custom_id") ||
    raw.startsWith("custom_image") ||
    raw.startsWith("custom_") ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

  const uuidMatch = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const effectivePageId = pageId || (raw.startsWith("custom_id:") && uuidMatch ? uuidMatch[0] : null);

  // 1. If pageId is provided and we have an image pointer or direct page route
  if (effectivePageId && isCustomImagePointer && !loadError) {
    return (
      <img
        src={`/api/pages/${effectivePageId}/icon`}
        alt="Page icon"
        className={cn("h-4 w-4 rounded object-cover shrink-0 select-none", imgClassName)}
        onError={() => setLoadError(true)}
      />
    );
  }

  // 2. Direct web URLs, blob URLs, data URIs, or explicit /api/pages/ routes
  if (
    !loadError &&
    (raw.startsWith("/api/pages/") ||
      raw.startsWith("http://") ||
      raw.startsWith("https://") ||
      raw.startsWith("blob:") ||
      raw.startsWith("data:image/"))
  ) {
    return (
      <img
        src={raw}
        alt="Page icon"
        className={cn("h-4 w-4 rounded object-cover shrink-0 select-none", imgClassName)}
        onError={() => setLoadError(true)}
      />
    );
  }

  // 3. Guard against leaking raw identifier strings into the UI as text
  if (isCustomImagePointer || raw.length > 8) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center leading-none shrink-0 select-none",
          className
        )}
      >
        {fallback}
      </span>
    );
  }

  // 4. Clean Unicode emoji glyph or single symbol
  const glyph = raw || fallback;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center leading-none shrink-0 select-none",
        className
      )}
    >
      {glyph}
    </span>
  );
}
