"use client";

import * as React from "react";
import {
  X,
  MessageSquare,
  Send,
  CheckCircle2,
  Trash2,
  User,
  Clock,
  Sparkles,
} from "lucide-react";
import { PageCommentRecord } from "@/lib/pages/types";
import { formatRelativeTime, formatExactDateTime } from "@/lib/utils/time";
import {
  createPageCommentAction,
  resolvePageCommentAction,
  deletePageCommentAction,
} from "@/lib/pages/actions";
import { cn } from "@/lib/utils";

interface PageCommentsPanelProps {
  pageId: string;
  isOpen: boolean;
  onClose: () => void;
  comments: PageCommentRecord[];
  onRefresh: () => Promise<void>;
}

export function PageCommentsPanel({
  pageId,
  isOpen,
  onClose,
  comments,
  onRefresh,
}: PageCommentsPanelProps) {
  const [content, setContent] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "active" | "resolved">("active");

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() || submitting) return;

    try {
      setSubmitting(true);
      const res = await createPageCommentAction({
        pageId,
        content: content.trim(),
      });
      if (res.success) {
        setContent("");
        await onRefresh();
      }
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleToggleResolve = async (commentId: string, currentResolved: boolean) => {
    try {
      await resolvePageCommentAction({
        pageId,
        commentId,
        isResolved: !currentResolved,
      });
      await onRefresh();
    } catch (err) {
      console.error("Failed to toggle resolve:", err);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deletePageCommentAction({ pageId, commentId });
      await onRefresh();
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  const filteredComments = comments.filter((c) => {
    if (filter === "active") return !c.is_resolved;
    if (filter === "resolved") return c.is_resolved;
    return true;
  });

  const activeCount = comments.filter((c) => !c.is_resolved).length;

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
            <MessageSquare className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Page Comments
            </h2>
            {activeCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-medium">
                {activeCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center px-6 py-2.5 border-b border-zinc-100 dark:border-zinc-800/80 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={cn(
              "px-2.5 py-1 rounded-lg font-medium transition-colors",
              filter === "active"
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            )}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("resolved")}
            className={cn(
              "px-2.5 py-1 rounded-lg font-medium transition-colors",
              filter === "resolved"
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            )}
          >
            Resolved ({comments.length - activeCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "px-2.5 py-1 rounded-lg font-medium transition-colors",
              filter === "all"
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            )}
          >
            All ({comments.length})
          </button>
        </div>

        {/* Comment List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredComments.length === 0 ? (
            <div className="text-center py-12 text-xs text-zinc-400">
              {filter === "resolved"
                ? "No resolved comments."
                : "No comments yet. Start a discussion below."}
            </div>
          ) : (
            filteredComments.map((comment) => {
              const authorName =
                comment.author_profile?.full_name ||
                comment.author_profile?.email ||
                "Team member";

              const authorInitial = authorName.charAt(0).toUpperCase();

              return (
                <div
                  key={comment.id}
                  className={cn(
                    "p-4 rounded-xl border transition-all space-y-2 group",
                    comment.is_resolved
                      ? "border-zinc-100 dark:border-zinc-800/40 bg-zinc-50/40 dark:bg-zinc-950/20 opacity-75"
                      : "border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/40"
                  )}
                >
                  {/* Top Bar: Author, Avatar, Time & Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                        {authorInitial}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          {authorName}
                        </span>
                        <span
                          className="text-[11px] text-zinc-400 dark:text-zinc-500 cursor-help"
                          title={formatExactDateTime(comment.created_at)}
                        >
                          · {formatRelativeTime(comment.created_at)}
                        </span>
                        {comment.is_edited && (
                          <span className="text-[10px] text-zinc-400 italic">
                            (edited)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleToggleResolve(comment.id, comment.is_resolved)}
                        className={cn(
                          "p-1 rounded-md text-xs transition-colors",
                          comment.is_resolved
                            ? "text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                            : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                        )}
                        title={comment.is_resolved ? "Mark unresolved" : "Resolve comment"}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(comment.id)}
                        className="p-1 rounded-md text-xs text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Delete comment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Comment Body */}
                  <div className="text-xs text-zinc-800 dark:text-zinc-200 pl-8 leading-relaxed whitespace-pre-wrap">
                    {comment.content}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Box */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/30">
          <form onSubmit={handleSubmit} className="space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Leave a comment... (Cmd+Enter to post)"
              rows={3}
              className="w-full text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-none transition-all"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-400">
                Tip: Press <kbd className="font-mono">⌘+Enter</kbd> to submit
              </span>
              <button
                type="submit"
                disabled={!content.trim() || submitting}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-3 w-3" />
                <span>{submitting ? "Posting..." : "Comment"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
