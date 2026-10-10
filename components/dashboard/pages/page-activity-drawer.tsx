"use client";

import * as React from "react";
import {
  X,
  History,
  Activity,
  RotateCcw,
  Sparkles,
  Edit3,
  MessageSquare,
  Link2,
  FileUp,
  Trash2,
  Clock,
  User,
  CheckCircle2,
  FolderInput,
} from "lucide-react";
import { PageActivityRecord, PageVersionRecord } from "@/lib/pages/types";
import { formatRelativeTime, formatExactDateTime } from "@/lib/utils/time";
import { restorePageVersionAction } from "@/lib/pages/actions";
import { cn } from "@/lib/utils";

interface PageActivityDrawerProps {
  pageId: string;
  isOpen: boolean;
  onClose: () => void;
  activities: PageActivityRecord[];
  versions: PageVersionRecord[];
  onRefresh: () => Promise<void>;
}

export function PageActivityDrawer({
  pageId,
  isOpen,
  onClose,
  activities,
  versions,
  onRefresh,
}: PageActivityDrawerProps) {
  const [activeTab, setActiveTab] = React.useState<"activity" | "history">("activity");
  const [restoringVersionId, setRestoringVersionId] = React.useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleRestore = async (versionId: string) => {
    try {
      setRestoringVersionId(versionId);
      const res = await restorePageVersionAction({ pageId, versionId });
      if (res.success) {
        setConfirmRestoreId(null);
        await onRefresh();
        // Reload page to reflect restored content
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to restore version:", err);
    } finally {
      setRestoringVersionId(null);
    }
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case "page_created":
        return <Sparkles className="h-3.5 w-3.5 text-amber-500" />;
      case "page_renamed":
        return <Edit3 className="h-3.5 w-3.5 text-blue-500" />;
      case "content_edited":
        return <Clock className="h-3.5 w-3.5 text-indigo-500" />;
      case "comment_added":
        return <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />;
      case "comment_resolved":
        return <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" />;
      case "connection_added":
        return <Link2 className="h-3.5 w-3.5 text-purple-500" />;
      case "page_moved":
        return <FolderInput className="h-3.5 w-3.5 text-orange-500" />;
      case "version_restored":
        return <RotateCcw className="h-3.5 w-3.5 text-rose-500" />;
      default:
        return <Activity className="h-3.5 w-3.5 text-zinc-400" />;
    }
  };

  const getActivityDescription = (activity: PageActivityRecord) => {
    const actorName =
      activity.actor_profile?.full_name ||
      activity.actor_profile?.email ||
      "Someone";

    switch (activity.action) {
      case "page_created":
        return `${actorName} created this page`;
      case "page_renamed":
        const newTitle = (activity.metadata?.new_title as string) || "Untitled";
        return `${actorName} renamed this page to "${newTitle}"`;
      case "content_edited":
        return `${actorName} edited the content`;
      case "comment_added":
        return `${actorName} added a comment`;
      case "comment_resolved":
        return `${actorName} resolved a comment`;
      case "connection_added":
        const targetTitle = (activity.metadata?.target_title as string) || "an object";
        return `${actorName} connected this page to "${targetTitle}"`;
      case "page_moved":
        return `${actorName} moved this page`;
      case "version_restored":
        const verNum = activity.metadata?.restored_version_number;
        return `${actorName} restored version ${verNum ? `#${verNum}` : ""}`;
      default:
        return `${actorName} performed an action`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Activity & History
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-6 pt-3 border-b border-zinc-100 dark:border-zinc-800/80 gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={cn(
              "pb-2.5 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5",
              activeTab === "activity"
                ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            )}
          >
            <Activity className="h-3.5 w-3.5" />
            Activity ({activities.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cn(
              "pb-2.5 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5",
              activeTab === "history"
                ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            )}
          >
            <History className="h-3.5 w-3.5" />
            Versions ({versions.length})
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === "activity" ? (
            activities.length === 0 ? (
              <div className="text-center py-12 text-xs text-zinc-400">
                No activity recorded yet for this page.
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-200 dark:before:bg-zinc-800">
                {activities.map((act) => (
                  <div key={act.id} className="relative group">
                    {/* Event Icon Pin */}
                    <div className="absolute -left-6 top-0.5 flex items-center justify-center h-5 w-5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                      {getActivityIcon(act.action)}
                    </div>

                    {/* Event Details */}
                    <div>
                      <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
                        {getActivityDescription(act)}
                      </p>
                      <span
                        className="text-[10px] text-zinc-400 dark:text-zinc-500 cursor-help mt-0.5 block"
                        title={formatExactDateTime(act.created_at)}
                      >
                        {formatRelativeTime(act.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-xs text-zinc-400">
              No version history saved yet.
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((ver) => {
                const authorName =
                  ver.creator_profile?.full_name ||
                  ver.creator_profile?.email ||
                  "Team member";

                const isConfirming = confirmRestoreId === ver.id;
                const isRestoring = restoringVersionId === ver.id;

                return (
                  <div
                    key={ver.id}
                    className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/30 flex items-center justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          Version {ver.version_number}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono">
                          {Array.isArray(ver.content) ? ver.content.length : 0} blocks
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        By {authorName} ·{" "}
                        <span
                          className="cursor-help text-zinc-400 dark:text-zinc-500"
                          title={formatExactDateTime(ver.created_at)}
                        >
                          {formatRelativeTime(ver.created_at)}
                        </span>
                      </div>
                    </div>

                    <div>
                      {isConfirming ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isRestoring}
                            onClick={() => handleRestore(ver.id)}
                            className="px-2 py-1 rounded-md text-[11px] font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
                          >
                            {isRestoring ? "Restoring..." : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRestoreId(null)}
                            className="px-2 py-1 rounded-md text-[11px] font-medium text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRestoreId(ver.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 transition-colors"
                          title="Restore this version"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Restore</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
