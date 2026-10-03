"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, Copy, Trash2, Link as LinkIcon, Star } from "lucide-react";
import { PageRecord } from "@/lib/pages/types";
import {
  createPageAction,
  duplicatePageAction,
  archivePageAction,
  togglePageFavoriteAction,
} from "@/lib/pages/actions";
import { cn } from "@/lib/utils";

interface PageActionsMenuProps {
  page: PageRecord;
}

export function PageActionsMenu({ page }: PageActionsMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [isFavorite, setIsFavorite] = React.useState(Boolean(page.is_favorite));
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setIsFavorite(Boolean(page.is_favorite));
  }, [page.is_favorite]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleToggleFavorite = async () => {
    const nextVal = !isFavorite;
    setIsFavorite(nextVal);
    const res = await togglePageFavoriteAction({ pageId: page.id });
    if (!res.success) {
      setIsFavorite(Boolean(page.is_favorite));
    } else {
      router.refresh();
    }
  };

  const handleAddSubpage = async () => {
    setIsOpen(false);
    const res = await createPageAction({
      parentPageId: page.id,
      title: "Untitled",
    });
    if (res.success && res.page) {
      router.push(`/dashboard/pages/${res.page.id}`);
    }
  };

  const handleDuplicate = async () => {
    setIsOpen(false);
    const res = await duplicatePageAction({ pageId: page.id });
    if (res.success && res.page) {
      router.push(`/dashboard/pages/${res.page.id}`);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => {
      setCopiedLink(false);
      setIsOpen(false);
    }, 1500);
  };

  const handleArchive = async () => {
    if (!window.confirm("Move this page to trash?")) return;
    setIsOpen(false);
    const res = await archivePageAction({ pageId: page.id });
    if (res.success) {
      router.push("/dashboard/pages");
    }
  };

  return (
    <div className="flex items-center gap-1 select-none">
      {/* Quick Star Favorite Toggle */}
      <button
        type="button"
        onClick={handleToggleFavorite}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
          isFavorite
            ? "text-amber-500 hover:bg-amber-500/10"
            : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        )}
        title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
      >
        <Star className={cn("h-4 w-4 transition-transform active:scale-125", isFavorite && "fill-amber-500")} />
      </button>

      {/* More Options Dropdown */}
      <div className="relative inline-block" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Page options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 select-none">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                handleToggleFavorite();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Star
                className={cn(
                  "h-3.5 w-3.5",
                  isFavorite ? "fill-amber-500 text-amber-500" : "text-zinc-400"
                )}
              />
              {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
            </button>

            <button
              type="button"
              onClick={handleAddSubpage}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add subpage
            </button>

            <button
              type="button"
              onClick={handleDuplicate}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              {copiedLink ? "Link copied!" : "Copy link"}
            </button>

            <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />

            <button
              type="button"
              onClick={handleArchive}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete / Archive
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
