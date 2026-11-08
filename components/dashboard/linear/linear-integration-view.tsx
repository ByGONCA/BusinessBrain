"use client";

import * as React from "react";
import Image from "next/image";
import {
  ExternalLink,
  RefreshCw,
  LogOut,
  Layers,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  FolderKanban,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LinearIntelligenceSnapshot } from "@/lib/integrations/linear/types";
import { disconnectLinearAction, getLinearIntelligenceSnapshotAction } from "@/lib/integrations/linear/actions";

interface LinearIntegrationViewProps {
  initialSnapshot: LinearIntelligenceSnapshot;
  organizationId: string;
}

export function LinearIntegrationView({
  initialSnapshot,
  organizationId,
}: LinearIntegrationViewProps) {
  const [snapshot, setSnapshot] = React.useState<LinearIntelligenceSnapshot>(initialSnapshot);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = React.useState(false);
  const [feedbackMessage, setFeedbackMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setFeedbackMessage(null);
    try {
      const res = await getLinearIntelligenceSnapshotAction(organizationId);
      if (res.success && res.data) {
        setSnapshot(res.data);
        setFeedbackMessage({ type: "success", text: "Provider diagnostics and snapshot refreshed." });
      } else {
        setFeedbackMessage({ type: "error", text: res.error || "Failed to refresh data." });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Network error while refreshing." });
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setFeedbackMessage(null);
    try {
      const res = await disconnectLinearAction(organizationId);
      if (res.success) {
        window.dispatchEvent(
          new CustomEvent("cb-integration-changed", {
            detail: { provider: "linear", status: "disconnected" },
          })
        );
        window.location.reload();
      } else {
        setFeedbackMessage({ type: "error", text: res.error || "Failed to disconnect Linear." });
        setIsDisconnecting(false);
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to disconnect." });
      setIsDisconnecting(false);
    }
  };

  const { providerHealth, velocityMetrics, workspace, connectedAccount, activeCycle, activeProjects, recentIssuesSample } = snapshot;

  const isReady = providerHealth.readiness === "ready";
  const isPartial = providerHealth.readiness === "partial";

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={cn(
            "p-3 rounded-xl text-xs font-medium border flex items-center justify-between",
            feedbackMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          )}
        >
          <span>{feedbackMessage.text}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Connection Status */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-zinc-900 dark:bg-white/10 flex items-center justify-center p-2.5 border border-white/10 shrink-0">
              <Image
                src="/Logos/linear-icon.svg"
                alt="Linear"
                width={28}
                height={28}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-foreground tracking-tight">
                  {workspace.name || "Linear Workspace"}
                </h1>
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                External Data Provider for KogSync Intelligence Engine • Connected as{" "}
                <span className="text-foreground font-medium">{connectedAccount.name}</span>
                {connectedAccount.email ? ` (${connectedAccount.email})` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`https://linear.app/${workspace.urlKey || ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted px-3 py-2 text-xs font-medium text-foreground transition-colors"
            >
              <span>Open in Linear</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted px-3 py-2 text-xs font-medium text-foreground transition-colors disabled:opacity-50"
              title="Refresh Linear Diagnostics"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-blue-400")} />
              <span>Refresh</span>
            </button>

            {!showConfirmDisconnect ? (
              <button
                onClick={() => setShowConfirmDisconnect(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Disconnect</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 p-1 rounded-xl">
                <span className="text-xs text-rose-400 px-2">Revoke access?</span>
                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-500 transition-colors disabled:opacity-50"
                >
                  {isDisconnecting ? "Revoking..." : "Confirm"}
                </button>
                <button
                  onClick={() => setShowConfirmDisconnect(false)}
                  disabled={isDisconnecting}
                  className="rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Intelligence Readiness & Diagnostics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-border">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              Intelligence Readiness
            </span>
            <div className="flex items-center gap-2 pt-0.5">
              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  isReady ? "bg-emerald-400" : isPartial ? "bg-amber-400" : "bg-zinc-500"
                )}
              />
              <span className="text-xs font-semibold text-foreground">
                {isReady ? "Ready for Intelligence" : isPartial ? "Partial Data Ready" : "Data Unavailable"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-1">
              {providerHealth.readinessReason}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-purple-400" />
              Retrieved Issues
            </span>
            <div className="text-lg font-bold text-foreground">
              {providerHealth.itemCounts.issues}
            </div>
            <p className="text-[11px] text-muted-foreground">Available for AI correlation</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <FolderKanban className="h-3.5 w-3.5 text-emerald-400" />
              Active Projects
            </span>
            <div className="text-lg font-bold text-foreground">
              {providerHealth.itemCounts.projects}
            </div>
            <p className="text-[11px] text-muted-foreground">Across {providerHealth.itemCounts.teams} teams</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              Active Cycle
            </span>
            <div className="text-sm font-bold text-foreground truncate">
              {activeCycle ? activeCycle.name : "None active"}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {activeCycle ? `${activeCycle.progressPercentage}% progress` : "No ongoing cycle"}
            </p>
          </div>
        </div>
      </div>

      {/* Velocity & Sprint Intelligence Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-foreground">
              Sprint Velocity & Execution Insights
            </h2>
          </div>
          {velocityMetrics.periodReference && (
            <span className="text-xs text-muted-foreground">
              Period: <span className="text-foreground font-medium">{velocityMetrics.periodReference}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Velocity Status</span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  velocityMetrics.velocityStatus === "on_track"
                    ? "bg-emerald-400"
                    : velocityMetrics.velocityStatus === "behind"
                    ? "bg-amber-400"
                    : "bg-zinc-500"
                )}
              />
              <span className="text-xs font-semibold text-foreground capitalize">
                {velocityMetrics.velocityStatus.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {velocityMetrics.explanation}
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Completed in Cycle</span>
            <div className="text-xl font-bold text-foreground">
              {velocityMetrics.completedIssuesCount}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">
                / {velocityMetrics.totalCycleIssuesCount} issues
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, velocityMetrics.completionRatePercentage || 0)}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Calculation Methodology</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Strictly derived from live Linear cycle issues. No predictive estimation or fabricated metrics are injected.
            </p>
          </div>
        </div>
      </div>

      {/* Normalized Data Preview (Sample of latest issues for verification) */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Normalized Data Preview (Diagnostic Sample)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live sample of normalized entities streamed directly from Linear GraphQL into KogSync.
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {recentIssuesSample.length} recent items
          </span>
        </div>

        {recentIssuesSample.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No issues found in this workspace yet.
          </div>
        ) : (
          <div className="divide-y divide-border border border-border/60 rounded-xl overflow-hidden">
            {recentIssuesSample.map((issue) => (
              <div
                key={issue.id}
                className="p-3.5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono font-semibold text-foreground shrink-0 bg-muted/60 px-2 py-0.5 rounded">
                    {issue.identifier}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xs font-medium text-foreground truncate">
                      {issue.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <span>{issue.teamName}</span>
                      <span>•</span>
                      <span className="capitalize">{issue.stateName}</span>
                      {issue.assigneeName && (
                        <>
                          <span>•</span>
                          <span>{issue.assigneeName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded uppercase tracking-wider",
                      issue.priorityLevel === "urgent"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : issue.priorityLevel === "high"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {issue.priorityLevel}
                  </span>

                  <a
                    href={issue.linearUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Open issue in Linear"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Zero-Storage Architecture Notice */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80 pt-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span>
            Zero Database Replication: No issues, projects, or comments are stored in KogSync tables. All intelligence is evaluated on demand.
          </span>
        </div>
      </div>
    </div>
  );
}
