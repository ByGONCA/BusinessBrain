"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronRight,
  Building2,
  Star,
  Link2,
  Check,
  ExternalLink,
  Columns2,
  X,
} from "lucide-react";
import { PageBreadcrumbItem } from "@/lib/pages/types";
import { PageIcon } from "./page-icon";
import { cn } from "@/lib/utils";

interface PageBreadcrumbsProps {
  breadcrumbs: PageBreadcrumbItem[];
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onOpenSidePeek?: () => void;
  showSidePeekAction?: boolean;
  onClose?: () => void;
  className?: string;
}

export function PageBreadcrumbs({
  breadcrumbs,
  isFavorite,
  onToggleFavorite,
  onOpenSidePeek,
  showSidePeekAction = false,
  onClose,
  className,
}: PageBreadcrumbsProps) {
  const [copied, setCopied] = React.useState(false);
  const [localCrumbs, setLocalCrumbs] = React.useState<PageBreadcrumbItem[]>(breadcrumbs);

  // Sync props to state
  React.useEffect(() => {
    setLocalCrumbs(breadcrumbs);
  }, [breadcrumbs]);

  // Listen to dynamic page title/icon updates
  React.useEffect(() => {
    function handlePageUpdate(event: Event) {
      const customEvent = event as CustomEvent<{
        pageId: string;
        title: string;
        icon: string;
      }>;
      if (!customEvent.detail) return;
      const { pageId, title, icon } = customEvent.detail;

      setLocalCrumbs((prev) =>
        prev.map((c) =>
          c.id === pageId ? { ...c, title, icon: icon || c.icon } : c
        )
      );
    }

    window.addEventListener("cb-page-updated", handlePageUpdate);
    return () => window.removeEventListener("cb-page-updated", handlePageUpdate);
  }, []);

  const leafCrumb = localCrumbs[localCrumbs.length - 1];

  const handleCopyLink = async () => {
    if (typeof window !== "undefined" && leafCrumb) {
      const url = `${window.location.origin}/dashboard/pages/${leafCrumb.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenNewTab = () => {
    if (typeof window !== "undefined" && leafCrumb) {
      window.open(`/dashboard/pages/${leafCrumb.id}`, "_blank");
    }
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-20 w-full flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-4 py-2 select-none transition-colors",
        className
      )}
    >
      {/* Left: VS Code-style Hierarchical Path */}
      <nav
        aria-label="Breadcrumbs"
        className="flex items-center gap-1 text-xs text-zinc-500 min-w-0 overflow-x-auto no-scrollbar py-0.5"
      >
        {/* Workspace Root Segment */}
        <Link
          href="/dashboard/pages"
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors shrink-0 text-zinc-500 dark:text-zinc-400"
          title="Company Brain Workspace"
        >
          <Building2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="font-medium text-[11px] tracking-tight">Workspace</span>
        </Link>

        {localCrumbs.length > 0 && (
          <ChevronRight className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-700" />
        )}

        {/* Path Ancestors & Active Page */}
        {localCrumbs.map((crumb, idx) => {
          const isLast = idx === localCrumbs.length - 1;

          return (
            <React.Fragment key={crumb.id}>
              {idx > 0 && (
                <ChevronRight className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-700" />
              )}
              {isLast ? (
                <span
                  className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-zinc-100/70 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 font-semibold text-[11px] tracking-tight truncate max-w-[240px]"
                  title={crumb.title || "Untitled"}
                >
                  <PageIcon
                    icon={crumb.icon}
                    className="h-3.5 w-3.5 text-xs select-none shrink-0"
                    imgClassName="h-3.5 w-3.5 rounded object-cover shrink-0"
                  />
                  <span className="truncate">{crumb.title || "Untitled"}</span>
                </span>
              ) : (
                <Link
                  href={`/dashboard/pages/${crumb.id}`}
                  className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors truncate max-w-[180px] text-[11px]"
                  title={crumb.title || "Untitled"}
                >
                  <PageIcon
                    icon={crumb.icon}
                    className="h-3.5 w-3.5 text-xs select-none shrink-0"
                    imgClassName="h-3.5 w-3.5 rounded object-cover shrink-0"
                  />
                  <span className="truncate">{crumb.title || "Untitled"}</span>
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Right: Path Header Quick Actions (VS Code-style editor action controls) */}
      <div className="flex items-center gap-0.5 shrink-0 ml-3">
        {/* Toggle Favorite Star */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              isFavorite
                ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
            title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-amber-500")} />
          </button>
        )}

        {/* Copy Path / Link */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Copy page link"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Open in New Tab */}
        <button
          type="button"
          onClick={handleOpenNewTab}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Open in new browser tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>

        {/* Side Peek Split View Toggle (if not inside side peek) */}
        {showSidePeekAction && onOpenSidePeek && (
          <button
            type="button"
            onClick={onOpenSidePeek}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Open in side peek (split view)"
          >
            <Columns2 className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Close Button (for side peek panel) */}
        {onClose && (
          <>
            <div className="h-3.5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Close panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
