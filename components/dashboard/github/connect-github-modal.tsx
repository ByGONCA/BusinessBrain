"use client";

import * as React from "react";
import {
  X,
  Link as LinkIcon,
  FolderKanban,
  CheckSquare,
  FileText,
  Users,
  GitBranch,
  Target,
  User,
  Plus,
  Loader2,
  ExternalLink,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  connectGitHubObjectAction,
  getConnectedObjectsForGitHubAction,
} from "@/lib/integrations/github/actions";

interface ConnectGitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceType: "github_repo" | "github_pr" | "github_issue" | "github_commit" | "github_release";
  sourceId: string;
  sourceTitle: string;
}

const TARGET_TYPES = [
  { id: "project", label: "Project", icon: FolderKanban },
  { id: "task", label: "Task", icon: CheckSquare },
  { id: "page", label: "Page", icon: FileText },
  { id: "meeting", label: "Meeting", icon: Users },
  { id: "decision", label: "Decision", icon: GitBranch },
  { id: "goal", label: "Goal", icon: Target },
  { id: "person", label: "Person", icon: User },
] as const;

export function ConnectGitHubModal({
  isOpen,
  onClose,
  sourceType,
  sourceId,
  sourceTitle,
}: ConnectGitHubModalProps) {
  const [targetType, setTargetType] = React.useState<typeof TARGET_TYPES[number]["id"]>("project");
  const [targetTitle, setTargetTitle] = React.useState("");
  const [targetId, setTargetId] = React.useState("");
  const [relationshipType, setRelationshipType] = React.useState("implements");
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [connections, setConnections] = React.useState<any[]>([]);
  const [loadingConnections, setLoadingConnections] = React.useState(false);

  const loadConnections = React.useCallback(async () => {
    if (!sourceId) return;
    setLoadingConnections(true);
    try {
      const res = await getConnectedObjectsForGitHubAction(sourceId);
      if (res.success) {
        setConnections(res.connections);
      }
    } finally {
      setLoadingConnections(false);
    }
  }, [sourceId]);

  React.useEffect(() => {
    if (isOpen) {
      loadConnections();
      setSuccess(false);
      setTargetTitle("");
      setTargetId("");
    }
  }, [isOpen, loadConnections]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTitle.trim()) return;

    setSubmitting(true);
    try {
      const res = await connectGitHubObjectAction({
        sourceType,
        sourceId,
        sourceTitle,
        targetType,
        targetId: targetId.trim() || `ref-${Date.now()}`,
        targetTitle: targetTitle.trim(),
        relationshipType,
      });

      if (res.success) {
        setSuccess(true);
        setTargetTitle("");
        setTargetId("");
        await loadConnections();
        setTimeout(() => setSuccess(false), 2000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 text-blue-500 border border-blue-500/20">
              <LinkIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Connect to BusinessBrain</h3>
              <p className="text-xs text-muted-foreground truncate max-w-sm">
                Link <span className="font-mono text-foreground font-medium">{sourceTitle}</span> to your company knowledge graph
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form to add connection */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">
              Target Entity Type
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {TARGET_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = targetType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTargetType(t.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors justify-center",
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Object Name / Title
              </label>
              <input
                type="text"
                required
                value={targetTitle}
                onChange={(e) => setTargetTitle(e.target.value)}
                placeholder={`e.g. Q4 Platform Migration`}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Relationship
              </label>
              <select
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-blue-500 focus:outline-none"
              >
                <option value="implements">Implements</option>
                <option value="resolves">Resolves</option>
                <option value="documents">Documents</option>
                <option value="related_to">Related To</option>
                <option value="blocks">Blocks</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting || !targetTitle.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : success ? (
                <Check className="h-3.5 w-3.5 text-white" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>{success ? "Connected!" : "Connect Object"}</span>
            </button>
          </div>
        </form>

        {/* Existing Connections Section */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-2">
            <span>Linked Company Objects ({connections.length})</span>
            {loadingConnections && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>

          {connections.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2 text-center">
              No company objects linked yet.
            </p>
          ) : (
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {connections.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="capitalize text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {c.target_type}
                    </span>
                    <span className="truncate font-medium text-foreground">{c.target_title}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                    {c.relationship_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
