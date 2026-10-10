"use client";

import * as React from "react";
import {
  X,
  MessageSquare,
  Send,
  Loader2,
  Lock,
  CornerDownRight,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getEntityCommentsAction,
  addEntityCommentAction,
} from "@/lib/integrations/github/actions";
import { EntityCommentRecord } from "@/lib/integrations/github/types";

interface GitHubCommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  entityTitle: string;
}

export function GitHubCommentsDrawer({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityTitle,
}: GitHubCommentsDrawerProps) {
  const [comments, setComments] = React.useState<EntityCommentRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [commentText, setCommentText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [replyToId, setReplyToId] = React.useState<string | null>(null);

  const loadComments = React.useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await getEntityCommentsAction(entityType, entityId);
      if (res.success) {
        setComments(res.comments);
      }
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  React.useEffect(() => {
    if (isOpen) {
      loadComments();
      setCommentText("");
      setReplyToId(null);
    }
  }, [isOpen, loadComments]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await addEntityCommentAction(
        entityType,
        entityId,
        commentText,
        replyToId || undefined
      );

      if (res.success) {
        setCommentText("");
        setReplyToId(null);
        await loadComments();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatRelativeTime = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-card border-l border-border flex flex-col shadow-2xl text-card-foreground animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 text-blue-500 border border-blue-500/20 shrink-0">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate">Internal Discussion</h3>
              <p className="text-xs text-muted-foreground truncate">{entityTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Internal privacy badge */}
        <div className="px-4 py-2 bg-muted/40 border-b border-border flex items-center gap-2 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3 text-amber-500 shrink-0" />
          <span>Internal company notes — will never be posted to GitHub.</span>
        </div>

        {/* Comments Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-medium">No discussions yet</p>
              <p className="text-[11px] mt-0.5">Start an internal team conversation about this GitHub object.</p>
            </div>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "p-3 rounded-xl border border-border bg-card space-y-1.5 text-xs transition-colors",
                  c.parent_id && "ml-4 border-blue-500/20 bg-muted/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {c.author?.avatar_url ? (
                      <img
                        src={c.author.avatar_url}
                        alt={c.author.full_name || "Author"}
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center text-[10px] font-semibold">
                        {c.author?.full_name?.charAt(0) || "U"}
                      </div>
                    )}
                    <span className="font-semibold text-foreground">
                      {c.author?.full_name || "Team Member"}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(c.created_at)}
                  </span>
                </div>

                <p className="text-foreground whitespace-pre-wrap leading-relaxed">{c.content}</p>

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyToId(c.id);
                    }}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <CornerDownRight className="h-3 w-3" />
                    <span>Reply</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment input footer */}
        <div className="p-3 border-t border-border bg-card">
          {replyToId && (
            <div className="flex items-center justify-between mb-1.5 px-2 py-1 rounded bg-muted text-[11px] text-muted-foreground">
              <span>Replying to thread</span>
              <button
                type="button"
                onClick={() => setReplyToId(null)}
                className="text-xs hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write an internal note or mention teammates..."
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              className="rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-500 transition-colors disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
