"use client";

import * as React from "react";
import {
  Plus,
  Link2,
  Eye,
  MoreHorizontal,
  FilePlus,
  Layers,
  Sparkles,
  ListTree,
  Edit3,
  Copy,
  Archive,
  Check,
  ChevronDown,
  Star,
  MessageSquare,
  History,
  Info,
} from "lucide-react";
import { PageViewMode } from "@/lib/pages/types";
import { cn } from "@/lib/utils";

interface PageHeaderActionsProps {
  currentView: PageViewMode;
  connectionsCount: number;
  commentsCount?: number;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onViewChange: (view: PageViewMode) => void;
  onAddBlock: () => void;
  onAddSubpage: () => void;
  onOpenConnectModal: (type?: "create" | "link") => void;
  onCopyPageLink: () => void;
  onOpenComments?: () => void;
  onOpenActivity?: () => void;
  onOpenPageInfo?: () => void;
}

export function PageHeaderActions({
  currentView,
  connectionsCount,
  commentsCount = 0,
  isFavorite = false,
  onToggleFavorite,
  onViewChange,
  onAddBlock,
  onAddSubpage,
  onOpenConnectModal,
  onCopyPageLink,
  onOpenComments,
  onOpenActivity,
  onOpenPageInfo,
}: PageHeaderActionsProps) {
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);
  const [connectMenuOpen, setConnectMenuOpen] = React.useState(false);
  const [viewMenuOpen, setViewMenuOpen] = React.useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close menus on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
        setConnectMenuOpen(false);
        setViewMenuOpen(false);
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="flex items-center gap-1.5 select-none relative">
      {/* 0. Star Favorite Toggle [⭐] */}
      {onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          className={cn(
            "flex items-center justify-center h-7 w-7 rounded-lg border text-xs transition-all",
            isFavorite
              ? "border-amber-300 dark:border-amber-700/80 bg-amber-50 dark:bg-amber-950/40 text-amber-500 shadow-2xs hover:bg-amber-100 dark:hover:bg-amber-900/50"
              : "border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400"
          )}
          title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        >
          <Star
            className={cn(
              "h-3.5 w-3.5 transition-all active:scale-125",
              isFavorite ? "fill-amber-500 text-amber-500" : ""
            )}
          />
        </button>
      )}

      {/* 1. [+ Add ▾] */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setAddMenuOpen((prev) => !prev);
            setConnectMenuOpen(false);
            setViewMenuOpen(false);
            setMoreMenuOpen(false);
          }}
          className={cn(
            "flex items-center gap-1 h-7 px-2.5 rounded-lg border text-xs font-medium transition-colors",
            addMenuOpen
              ? "border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              : "border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          )}
        >
          <Plus className="h-3 w-3 text-zinc-500" />
          <span>Add</span>
          <ChevronDown className="h-3 w-3 text-zinc-400 opacity-60" />
        </button>

        {addMenuOpen && (
          <div className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={() => {
                setAddMenuOpen(false);
                onAddBlock();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-zinc-400" /> Add block
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMenuOpen(false);
                onAddSubpage();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <FilePlus className="h-3.5 w-3.5 text-zinc-400" /> Add subpage
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMenuOpen(false);
                onOpenConnectModal("create");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" /> Add related entity
            </button>
          </div>
        )}
      </div>

      {/* 2. [Connect ▾] */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setConnectMenuOpen((prev) => !prev);
            setAddMenuOpen(false);
            setViewMenuOpen(false);
            setMoreMenuOpen(false);
          }}
          className={cn(
            "flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-colors",
            connectMenuOpen
              ? "border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
              : "border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          )}
        >
          <Link2 className="h-3 w-3 text-indigo-500" />
          <span>Connect</span>
          {connectionsCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/60 px-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
              {connectionsCount}
            </span>
          )}
          <ChevronDown className="h-3 w-3 text-zinc-400 opacity-60" />
        </button>

        {connectMenuOpen && (
          <div className="absolute right-0 top-8 z-50 w-48 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={() => {
                setConnectMenuOpen(false);
                onViewChange("connections");
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-zinc-400" /> View connections
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">{connectionsCount}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setConnectMenuOpen(false);
                onOpenConnectModal("create");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Create connection
            </button>
            <button
              type="button"
              onClick={() => {
                setConnectMenuOpen(false);
                onOpenConnectModal("link");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Link2 className="h-3.5 w-3.5 text-zinc-400" /> Link existing entity
            </button>
          </div>
        )}
      </div>

      {/* 3. [View ▾] */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setViewMenuOpen((prev) => !prev);
            setAddMenuOpen(false);
            setConnectMenuOpen(false);
            setMoreMenuOpen(false);
          }}
          className={cn(
            "flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-colors capitalize",
            viewMenuOpen
              ? "border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              : "border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          )}
        >
          <Eye className="h-3 w-3 text-zinc-500" />
          <span>{currentView}</span>
          <ChevronDown className="h-3 w-3 text-zinc-400 opacity-60" />
        </button>

        {viewMenuOpen && (
          <div className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={() => {
                setViewMenuOpen(false);
                onViewChange("editor");
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                currentView === "editor"
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              <Edit3 className="h-3.5 w-3.5" /> Editor
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMenuOpen(false);
                onViewChange("outline");
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                currentView === "outline"
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              <ListTree className="h-3.5 w-3.5" /> Outline
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMenuOpen(false);
                onViewChange("connections");
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                currentView === "connections"
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              <span className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5" /> Connections
              </span>
              {connectionsCount > 0 && (
                <span className="text-[10px] text-zinc-400 font-mono">{connectionsCount}</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 4. Comments Toggle [💬] */}
      {onOpenComments && (
        <button
          type="button"
          onClick={onOpenComments}
          className="relative flex items-center justify-center h-7 px-2 gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs transition-colors"
          title="Comments"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {commentsCount > 0 && (
            <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
              {commentsCount}
            </span>
          )}
        </button>
      )}

      {/* 5. Activity & History Toggle [🕐] */}
      {onOpenActivity && (
        <button
          type="button"
          onClick={onOpenActivity}
          className="flex items-center justify-center h-7 w-7 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs transition-colors"
          title="Activity & History"
        >
          <History className="h-3.5 w-3.5" />
        </button>
      )}

      {/* 6. [···] */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setMoreMenuOpen((prev) => !prev);
            setAddMenuOpen(false);
            setConnectMenuOpen(false);
            setViewMenuOpen(false);
          }}
          className={cn(
            "flex items-center justify-center h-7 w-7 rounded-lg border text-xs transition-colors",
            moreMenuOpen
              ? "border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              : "border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          )}
          title="More page actions"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>

        {moreMenuOpen && (
          <div className="absolute right-0 top-8 z-50 w-48 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={async () => {
                setMoreMenuOpen(false);
                onCopyPageLink();
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
              <span>{copied ? "Link copied" : "Copy page link"}</span>
            </button>

            {onOpenPageInfo && (
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenPageInfo();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Info className="h-3.5 w-3.5 text-zinc-400" />
                <span>Page information</span>
              </button>
            )}

            {onOpenActivity && (
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenActivity();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <History className="h-3.5 w-3.5 text-zinc-400" />
                <span>Activity & History</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
