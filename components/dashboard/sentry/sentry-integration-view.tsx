"use client";

// ==============================================================================
// KogSync: Sentry Integration View (Projects, Issues & Error Intelligence)
// ==============================================================================

import * as React from "react";
import {
  ExternalLink,
  RefreshCw,
  LogOut,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  FolderGit2,
  Clock,
  ShieldCheck,
  ChevronRight,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SentryWorkspaceSnapshot,
  SentryIssue,
  SentryEventDetail,
} from "@/lib/integrations/sentry/types";
import {
  getSentryWorkspaceSnapshotAction,
  getSentryIssueDetailAction,
  setSelectedSentryProjectAction,
  disconnectSentryAction,
} from "@/lib/integrations/sentry/actions";

interface SentryIntegrationViewProps {
  initialSnapshot?: SentryWorkspaceSnapshot;
  organizationId?: string;
  onClose?: () => void;
}

export function SentryIntegrationView({
  initialSnapshot,
  organizationId,
  onClose,
}: SentryIntegrationViewProps) {
  const [snapshot, setSnapshot] = React.useState<SentryWorkspaceSnapshot>(
    initialSnapshot || {
      status: "disconnected",
      projects: [],
      recentIssues: [],
      totalUnresolvedCount: 0,
    }
  );
  const [isLoading, setIsLoading] = React.useState(!initialSnapshot);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [selectedIssueId, setSelectedIssueId] = React.useState<string | null>(null);
  const [issueDetail, setIssueDetail] = React.useState<{
    issue: SentryIssue;
    event: SentryEventDetail | null;
  } | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadSnapshot = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getSentryWorkspaceSnapshotAction(organizationId);
      if (res.success && res.data) {
        setSnapshot(res.data);
      } else if (res.error) {
        setFeedback({ type: "error", text: res.error });
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to connect to Sentry service." });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    if (!initialSnapshot) {
      loadSnapshot();
    }
  }, [initialSnapshot, loadSnapshot]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setFeedback(null);
    try {
      const res = await getSentryWorkspaceSnapshotAction(organizationId);
      if (res.success && res.data) {
        setSnapshot(res.data);
        setFeedback({ type: "success", text: "Sentry telemetry and issues refreshed." });
      } else {
        setFeedback({ type: "error", text: res.error || "Failed to refresh." });
      }
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleProjectChange = async (projectSlug: string) => {
    try {
      await setSelectedSentryProjectAction(projectSlug, organizationId);
      handleRefresh();
    } catch {
      setFeedback({ type: "error", text: "Failed to update active project." });
    }
  };

  const handleIssueClick = async (issueId: string) => {
    setSelectedIssueId(issueId);
    setIsLoadingDetail(true);
    try {
      const res = await getSentryIssueDetailAction(issueId, organizationId);
      if (res.success && res.data) {
        setIssueDetail(res.data);
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to load issue details." });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await disconnectSentryAction(organizationId);
      if (res.success) {
        setSnapshot({
          status: "disconnected",
          projects: [],
          recentIssues: [],
          totalUnresolvedCount: 0,
        });
        setFeedback({ type: "success", text: "Sentry disconnected successfully." });
        setShowConfirmDisconnect(false);
      } else {
        setFeedback({ type: "error", text: res.error || "Failed to disconnect." });
      }
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isConnected = snapshot.status === "connected";
  const isNeedsReauth = snapshot.status === "needs_reauth";

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={cn(
            "p-3 rounded-xl text-xs font-medium border flex items-center justify-between animate-in fade-in",
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          )}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-zinc-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 border border-white/[0.08]">
            <img src="/Logos/sentry-icon.svg" alt="Sentry" className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Sentry Error Intelligence</h3>
            <p className="text-[11px] text-zinc-400">
              {isConnected
                ? `Organization: ${snapshot.connectedAccount?.organizationName || snapshot.connectedAccount?.organizationSlug || "Connected"}`
                : isNeedsReauth
                ? "Reauthorization required"
                : "Not connected to any Sentry organization"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-zinc-900/60 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
                <span>Sync</span>
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmDisconnect(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-xs text-rose-400 hover:bg-rose-500/20 transition-colors"
              >
                <LogOut className="h-3 w-3" />
                <span>Disconnect</span>
              </button>
            </>
          )}

          {!isConnected && (
            <a
              href="/api/integrations/sentry/connect"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-xs transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Connect Sentry</span>
            </a>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ml-1"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
      {showConfirmDisconnect && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-3">
          <p className="text-xs text-rose-300 font-medium">
            Are you sure you want to disconnect Sentry? Encrypted tokens will be revoked and deleted.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors"
            >
              {isDisconnecting ? "Disconnecting..." : "Confirm Disconnect"}
            </button>
            <button
              onClick={() => setShowConfirmDisconnect(false)}
              className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Connection State: Disconnected Banner */}
      {!isConnected && !isNeedsReauth && !isLoading && (
        <div className="p-6 rounded-2xl border border-white/[0.06] bg-zinc-900/40 text-center space-y-3">
          <ShieldCheck className="mx-auto h-8 w-8 text-zinc-500" />
          <h4 className="text-sm font-semibold text-white">Connect your Sentry Organization</h4>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            Link your company&apos;s Sentry account via OAuth 2.0 to inspect live exceptions, project health,
            unresolved issues, and error trends directly inside your KogSync executive workspace.
          </p>
          <div className="pt-2">
            <a
              href="/api/integrations/sentry/connect"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-sm transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Authorize with Sentry</span>
            </a>
          </div>
        </div>
      )}

      {/* Connection State: Needs Reauth */}
      {isNeedsReauth && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-300">Reauthorization Required</p>
              <p className="text-[11px] text-zinc-400">Your Sentry OAuth session has expired or was revoked.</p>
            </div>
          </div>
          <a
            href="/api/integrations/sentry/connect"
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-colors"
          >
            Re-authenticate
          </a>
        </div>
      )}

      {/* Connected State: Project Selector & Issues Dashboard */}
      {isConnected && (
        <div className="space-y-4">
          {/* Project Selector Bar */}
          {snapshot.projects.length > 0 && (
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.06] bg-zinc-900/40">
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-zinc-400" />
                <span className="text-xs font-medium text-zinc-300">Active Project:</span>
                <select
                  value={snapshot.selectedProjectSlug || ""}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="bg-zinc-800 border border-white/[0.08] text-xs text-white rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500"
                >
                  {snapshot.projects.map((proj) => (
                    <option key={proj.id} value={proj.slug}>
                      {proj.name} ({proj.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>{snapshot.totalUnresolvedCount} Unresolved Issues</span>
              </div>
            </div>
          )}

          {/* Issues List & Drawer Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column: Issues List */}
            <div className={cn("space-y-2", selectedIssueId ? "lg:col-span-7" : "lg:col-span-12")}>
              {snapshot.recentIssues.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-white/[0.06] bg-zinc-900/20 text-zinc-400 text-xs">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-400 mb-2" />
                  No unresolved issues found in this project.
                </div>
              ) : (
                snapshot.recentIssues.map((issue) => {
                  const isSelected = selectedIssueId === issue.id;
                  const isFatal = issue.level === "fatal";
                  const isError = issue.level === "error";

                  return (
                    <div
                      key={issue.id}
                      onClick={() => handleIssueClick(issue.id)}
                      className={cn(
                        "p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left",
                        isSelected
                          ? "border-blue-500/40 bg-blue-500/[0.06]"
                          : "border-white/[0.06] bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-white/[0.12]"
                      )}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 shrink-0">
                          {isFatal ? (
                            <AlertOctagon className="h-4 w-4 text-rose-500" />
                          ) : isError ? (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Info className="h-4 w-4 text-blue-400" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-semibold text-white truncate">{issue.title}</p>
                          <p className="text-[11px] text-zinc-400 truncate">{issue.culprit || issue.shortId}</p>
                          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                            <span>Events: {issue.count}</span>
                            <span>Users: {issue.userCount}</span>
                            <span>Seen: {new Date(issue.lastSeen).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-md border border-white/[0.06] bg-zinc-800 text-zinc-300">
                          {issue.level}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Column: Issue Details Drawer */}
            {selectedIssueId && (
              <div className="lg:col-span-5 p-4 rounded-xl border border-white/[0.08] bg-zinc-900/60 space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <h4 className="text-xs font-semibold text-white">Issue Diagnostics</h4>
                  <button
                    onClick={() => {
                      setSelectedIssueId(null);
                      setIssueDetail(null);
                    }}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>

                {isLoadingDetail ? (
                  <div className="py-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Loading event telemetry...</span>
                  </div>
                ) : issueDetail ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="text-[11px] text-zinc-400">Title</p>
                      <p className="font-semibold text-white break-words">{issueDetail.issue.title}</p>
                    </div>

                    {issueDetail.issue.permalink && (
                      <div>
                        <a
                          href={issueDetail.issue.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-medium text-xs"
                        >
                          <span>Open in Sentry Dashboard</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}

                    {issueDetail.event && (
                      <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                        <p className="text-[11px] font-semibold text-zinc-300">Latest Event Tags</p>
                        <div className="flex flex-wrap gap-1.5">
                          {issueDetail.event.tags.slice(0, 10).map((tag, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-zinc-800 border border-white/[0.06] text-[10px] text-zinc-300"
                            >
                              {tag.key}: {tag.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400">No event details available.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
