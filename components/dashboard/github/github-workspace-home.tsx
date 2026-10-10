"use client";

import * as React from "react";
import Link from "next/link";
import {
  Github,
  GitPullRequest,
  AlertCircle,
  FolderGit2,
  Tag,
  Star,
  GitFork,
  Search,
  ExternalLink,
  Link as LinkIcon,
  MessageSquare,
  RefreshCw,
  Lock,
  Globe,
  Loader2,
  Calendar,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GitHubOverviewStats,
  GitHubRepository,
  GitHubActivityEvent,
} from "@/lib/integrations/github/types";
import {
  getGitHubOverviewAction,
  getGitHubRepositoriesAction,
} from "@/lib/integrations/github/actions";
import { ConnectGitHubModal } from "./connect-github-modal";
import { GitHubCommentsDrawer } from "./github-comments-drawer";

interface GitHubWorkspaceHomeProps {
  initialOverview?: GitHubOverviewStats;
  initialRepositories?: GitHubRepository[];
  organizationId: string;
}

export function GitHubWorkspaceHome({
  initialOverview,
  initialRepositories = [],
  organizationId,
}: GitHubWorkspaceHomeProps) {
  const [overview, setOverview] = React.useState<GitHubOverviewStats | undefined>(initialOverview);
  const [repositories, setRepositories] = React.useState<GitHubRepository[]>(initialRepositories);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"repositories" | "activity">("repositories");
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Modals state
  const [connectModal, setConnectModal] = React.useState<{
    isOpen: boolean;
    sourceType: "github_repo" | "github_pr" | "github_issue" | "github_commit" | "github_release";
    sourceId: string;
    sourceTitle: string;
  }>({
    isOpen: false,
    sourceType: "github_repo",
    sourceId: "",
    sourceTitle: "",
  });

  const [commentsDrawer, setCommentsDrawer] = React.useState<{
    isOpen: boolean;
    entityType: string;
    entityId: string;
    entityTitle: string;
  }>({
    isOpen: false,
    entityType: "github_repo",
    entityId: "",
    entityTitle: "",
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [ovRes, repoRes] = await Promise.all([
        getGitHubOverviewAction(organizationId),
        getGitHubRepositoriesAction(organizationId, { search: searchQuery }),
      ]);
      if (ovRes.success && ovRes.data) {
        setOverview(ovRes.data);
      }
      if (repoRes.success) {
        setRepositories(repoRes.repositories);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredRepos = React.useMemo(() => {
    if (!searchQuery.trim()) return repositories;
    const q = searchQuery.toLowerCase().trim();
    return repositories.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [repositories, searchQuery]);

  const formatRelativeTime = (iso: string) => {
    try {
      const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diff < 60) return "just now";
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-xs px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-foreground leading-tight">GitHub Workspace</h1>
                {overview?.connectedAccount && (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Connected source of truth for code, pull requests, issues, and releases.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              <span>Sync</span>
            </button>
            {overview?.accountUrl && (
              <a
                href={overview.accountUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
              >
                <span>View on GitHub</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Connected account banner & metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card: Repositories */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Repositories</span>
              <FolderGit2 className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {overview?.repositoriesCount ?? repositories.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Accessible workspaces</p>
          </div>

          {/* Card: Open Pull Requests */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Open Pull Requests</span>
              <GitPullRequest className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {overview?.openPullRequestsCount ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Pending review & merge</p>
          </div>

          {/* Card: Open Issues */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Open Issues</span>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {overview?.openIssuesCount ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Active bug reports & tasks</p>
          </div>

          {/* Card: Releases */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Published Releases</span>
              <Tag className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {overview?.recentReleasesCount ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Tagged deployments</p>
          </div>
        </div>

        {/* Tab Controls and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("repositories")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeTab === "repositories"
                  ? "bg-blue-600 text-white font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Repositories ({filteredRepos.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeTab === "activity"
                  ? "bg-blue-600 text-white font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Recent Activity ({overview?.recentActivity?.length ?? 0})
            </button>
          </div>

          {activeTab === "repositories" && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repositories..."
                className="w-full rounded-lg border border-input bg-card py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* TAB 1: REPOSITORIES */}
        {activeTab === "repositories" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRepos.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <FolderGit2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">No repositories found</p>
                <p className="text-[11px]">Check your GitHub permissions or try another search.</p>
              </div>
            ) : (
              filteredRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all shadow-2xs hover:shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/dashboard/github/${repo.owner.login}/${repo.name}`}
                        className="font-semibold text-sm text-foreground hover:text-blue-500 transition-colors line-clamp-1"
                      >
                        {repo.name}
                      </Link>
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border border-border bg-muted/60 text-muted-foreground shrink-0">
                        {repo.private ? (
                          <>
                            <Lock className="h-2.5 w-2.5" />
                            Private
                          </>
                        ) : (
                          <>
                            <Globe className="h-2.5 w-2.5" />
                            Public
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-8">
                      {repo.description || "No description provided."}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border mt-3 space-y-3">
                    {/* Meta tags */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {repo.language && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          {repo.language}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px]">
                        <Star className="h-3 w-3 text-amber-500" />
                        {repo.stargazers_count}
                      </span>
                      <span className="flex items-center gap-1 text-[11px]">
                        <GitFork className="h-3 w-3" />
                        {repo.forks_count}
                      </span>
                      <span className="ml-auto text-[10px]">
                        Updated {formatRelativeTime(repo.updated_at)}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-1">
                      <Link
                        href={`/dashboard/github/${repo.owner.login}/${repo.name}`}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Explore details →
                      </Link>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setConnectModal({
                              isOpen: true,
                              sourceType: "github_repo",
                              sourceId: repo.full_name,
                              sourceTitle: repo.name,
                            })
                          }
                          title="Connect to Brain Object"
                          className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <LinkIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCommentsDrawer({
                              isOpen: true,
                              entityType: "github_repo",
                              entityId: repo.full_name,
                              entityTitle: repo.name,
                            })
                          }
                          title="Discuss internally"
                          className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noreferrer"
                          title="Open in GitHub"
                          className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: RECENT ACTIVITY */}
        {activeTab === "activity" && (
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {(!overview?.recentActivity || overview.recentActivity.length === 0) ? (
              <div className="p-12 text-center text-muted-foreground">
                <Github className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">No recent activity detected</p>
                <p className="text-[11px]">Recent events like pull requests and commits will populate here.</p>
              </div>
            ) : (
              overview.recentActivity.map((evt) => (
                <div key={evt.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    {evt.actor.avatar_url ? (
                      <img
                        src={evt.actor.avatar_url}
                        alt={evt.actor.login}
                        className="h-7 w-7 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center font-bold text-xs shrink-0">
                        {evt.actor.login.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-foreground truncate font-medium">
                        <span className="font-semibold">{evt.actor.login}</span>{" "}
                        <span className="text-muted-foreground font-normal">
                          {evt.type === "pr_opened"
                            ? "opened pull request in"
                            : evt.type === "pr_merged"
                            ? "merged pull request in"
                            : evt.type === "issue_opened"
                            ? "opened issue in"
                            : evt.type === "issue_closed"
                            ? "closed issue in"
                            : evt.type === "commit_pushed"
                            ? "pushed commits to"
                            : "published release in"}{" "}
                        </span>
                        <span className="font-mono text-xs">{evt.repoName}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {evt.title} • {formatRelativeTime(evt.timestamp)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setConnectModal({
                          isOpen: true,
                          sourceType: "github_repo",
                          sourceId: evt.repoName,
                          sourceTitle: evt.repoName,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      Connect
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCommentsDrawer({
                          isOpen: true,
                          entityType: "github_activity",
                          entityId: evt.id,
                          entityTitle: `Activity on ${evt.repoName}`,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      Discuss
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Connect to Brain Object Modal */}
      <ConnectGitHubModal
        isOpen={connectModal.isOpen}
        onClose={() => setConnectModal((prev) => ({ ...prev, isOpen: false }))}
        sourceType={connectModal.sourceType}
        sourceId={connectModal.sourceId}
        sourceTitle={connectModal.sourceTitle}
      />

      {/* Internal Comments Drawer */}
      <GitHubCommentsDrawer
        isOpen={commentsDrawer.isOpen}
        onClose={() => setCommentsDrawer((prev) => ({ ...prev, isOpen: false }))}
        entityType={commentsDrawer.entityType}
        entityId={commentsDrawer.entityId}
        entityTitle={commentsDrawer.entityTitle}
      />
    </div>
  );
}
