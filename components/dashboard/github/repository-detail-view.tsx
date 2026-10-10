"use client";

import * as React from "react";
import Link from "next/link";
import {
  Github,
  GitPullRequest,
  AlertCircle,
  GitCommit,
  Tag,
  Users,
  Star,
  GitFork,
  ExternalLink,
  Link as LinkIcon,
  MessageSquare,
  ArrowLeft,
  Lock,
  Globe,
  Loader2,
  CheckCircle2,
  Clock,
  GitMerge,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GitHubRepository,
  GitHubPullRequest,
  GitHubIssue,
  GitHubCommit,
  GitHubRelease,
  GitHubContributor,
} from "@/lib/integrations/github/types";
import {
  getGitHubPullRequestsAction,
  getGitHubIssuesAction,
  getGitHubCommitsAction,
  getGitHubReleasesAction,
  getGitHubContributorsAction,
} from "@/lib/integrations/github/actions";
import { ConnectGitHubModal } from "./connect-github-modal";
import { GitHubCommentsDrawer } from "./github-comments-drawer";

interface RepositoryDetailViewProps {
  repository: GitHubRepository;
  organizationId: string;
}

type TabType = "overview" | "pulls" | "issues" | "commits" | "releases" | "contributors";

export function RepositoryDetailView({
  repository,
  organizationId,
}: RepositoryDetailViewProps) {
  const [activeTab, setActiveTab] = React.useState<TabType>("overview");

  // Tab Data States
  const [pullRequests, setPullRequests] = React.useState<GitHubPullRequest[]>([]);
  const [issues, setIssues] = React.useState<GitHubIssue[]>([]);
  const [commits, setCommits] = React.useState<GitHubCommit[]>([]);
  const [releases, setReleases] = React.useState<GitHubRelease[]>([]);
  const [contributors, setContributors] = React.useState<GitHubContributor[]>([]);
  const [loadingTab, setLoadingTab] = React.useState(false);

  // Filters
  const [prFilter, setPrFilter] = React.useState<"open" | "closed" | "all">("open");
  const [issueFilter, setIssueFilter] = React.useState<"open" | "closed" | "all">("open");

  // Modals
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

  // Lazy tab loader
  React.useEffect(() => {
    async function loadTabData() {
      setLoadingTab(true);
      try {
        if (activeTab === "pulls") {
          const res = await getGitHubPullRequestsAction(
            repository.owner.login,
            repository.name,
            { state: prFilter },
            organizationId
          );
          if (res.success) setPullRequests(res.pullRequests);
        } else if (activeTab === "issues") {
          const res = await getGitHubIssuesAction(
            repository.owner.login,
            repository.name,
            { state: issueFilter },
            organizationId
          );
          if (res.success) setIssues(res.issues);
        } else if (activeTab === "commits") {
          const res = await getGitHubCommitsAction(
            repository.owner.login,
            repository.name,
            {},
            organizationId
          );
          if (res.success) setCommits(res.commits);
        } else if (activeTab === "releases") {
          const res = await getGitHubReleasesAction(
            repository.owner.login,
            repository.name,
            {},
            organizationId
          );
          if (res.success) setReleases(res.releases);
        } else if (activeTab === "contributors") {
          const res = await getGitHubContributorsAction(
            repository.owner.login,
            repository.name,
            {},
            organizationId
          );
          if (res.success) setContributors(res.contributors);
        }
      } finally {
        setLoadingTab(false);
      }
    }

    if (activeTab !== "overview") {
      loadTabData();
    }
  }, [activeTab, prFilter, issueFilter, repository.owner.login, repository.name, organizationId]);

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
      {/* Breadcrumb & Repo Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-xs px-6 py-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href="/dashboard/github"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </Link>
            <span>/</span>
            <span className="text-muted-foreground">{repository.owner.login}</span>
            <span>/</span>
            <span className="font-semibold text-foreground">{repository.name}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm shrink-0">
                <Github className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-foreground leading-tight">
                    {repository.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border border-border bg-muted/60 text-muted-foreground">
                    {repository.private ? (
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
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xl truncate">
                  {repository.description || "No description provided."}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setConnectModal({
                    isOpen: true,
                    sourceType: "github_repo",
                    sourceId: repository.full_name,
                    sourceTitle: repository.name,
                  })
                }
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-muted transition-colors shadow-2xs"
              >
                <LinkIcon className="h-3.5 w-3.5 text-blue-500" />
                <span>Connect Object</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setCommentsDrawer({
                    isOpen: true,
                    entityType: "github_repo",
                    entityId: repository.full_name,
                    entityTitle: repository.name,
                  })
                }
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-muted transition-colors shadow-2xs"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Discussion</span>
              </button>

              <a
                href={repository.html_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:opacity-90 transition-opacity shadow-2xs"
              >
                <span>Open in GitHub</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-4 overflow-x-auto no-scrollbar">
          {[
            { id: "overview", label: "Overview", icon: Github },
            { id: "pulls", label: "Pull Requests", icon: GitPullRequest },
            { id: "issues", label: "Issues", icon: AlertCircle },
            { id: "commits", label: "Commits", icon: GitCommit },
            { id: "releases", label: "Releases", icon: Tag },
            { id: "contributors", label: "Contributors", icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0",
                  isSelected
                    ? "bg-blue-600 text-white font-semibold shadow-2xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {loadingTab ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-xs">Loading data from GitHub...</span>
          </div>
        ) : (
          <>
            {/* TAB: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <span className="text-xs text-muted-foreground">Primary Language</span>
                    <p className="text-lg font-bold text-foreground mt-1 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      {repository.language || "N/A"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <span className="text-xs text-muted-foreground">Default Branch</span>
                    <p className="text-lg font-bold text-foreground mt-1 font-mono">
                      {repository.default_branch || "main"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <span className="text-xs text-muted-foreground">Stars / Forks</span>
                    <p className="text-lg font-bold text-foreground mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-amber-500" /> {repository.stargazers_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="h-4 w-4" /> {repository.forks_count}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <span className="text-xs text-muted-foreground">Open Issues & PRs</span>
                    <p className="text-lg font-bold text-foreground mt-1">
                      {repository.open_issues_count}
                    </p>
                  </div>
                </div>

                {/* Clone & Links */}
                <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <h3 className="text-sm font-semibold">Repository Access & URL</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] text-muted-foreground block mb-1">Web URL</span>
                      <input
                        readOnly
                        value={repository.html_url}
                        className="w-full rounded-lg border border-input bg-muted/50 px-3 py-1.5 text-xs font-mono text-foreground select-all"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block mb-1">Clone URL (HTTPS)</span>
                      <input
                        readOnly
                        value={repository.clone_url || repository.html_url}
                        className="w-full rounded-lg border border-input bg-muted/50 px-3 py-1.5 text-xs font-mono text-foreground select-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PULL REQUESTS */}
            {activeTab === "pulls" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  {(["open", "closed", "all"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setPrFilter(filter)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors",
                        prFilter === filter
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                {pullRequests.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <GitPullRequest className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-medium">No pull requests found</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card divide-y divide-border">
                    {pullRequests.map((pr) => (
                      <div key={pr.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5">
                            {pr.merged_at ? (
                              <GitMerge className="h-4 w-4 text-purple-500" />
                            ) : pr.state === "open" ? (
                              <GitPullRequest className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <GitPullRequest className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={pr.html_url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-foreground hover:text-blue-500 transition-colors"
                              >
                                {pr.title}
                              </a>
                              <span className="text-muted-foreground font-mono">#{pr.number}</span>
                              {pr.labels.map((l) => (
                                <span
                                  key={l.name}
                                  className="text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/60 text-muted-foreground"
                                >
                                  {l.name}
                                </span>
                              ))}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Opened {formatRelativeTime(pr.created_at)} by {pr.user.login}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setConnectModal({
                                isOpen: true,
                                sourceType: "github_pr",
                                sourceId: `${repository.full_name}#${pr.number}`,
                                sourceTitle: `#${pr.number}: ${pr.title}`,
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
                                entityType: "github_pr",
                                entityId: `${repository.full_name}#${pr.number}`,
                                entityTitle: `#${pr.number}: ${pr.title}`,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            Discuss
                          </button>
                          <a
                            href={pr.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: ISSUES */}
            {activeTab === "issues" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  {(["open", "closed", "all"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setIssueFilter(filter)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors",
                        issueFilter === filter
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                {issues.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-medium">No issues found</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card divide-y divide-border">
                    {issues.map((iss) => (
                      <div key={iss.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                        <div className="flex items-start gap-3 min-w-0">
                          <AlertCircle
                            className={cn(
                              "h-4 w-4 mt-0.5 shrink-0",
                              iss.state === "open" ? "text-emerald-500" : "text-purple-500"
                            )}
                          />
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={iss.html_url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-foreground hover:text-blue-500 transition-colors"
                              >
                                {iss.title}
                              </a>
                              <span className="text-muted-foreground font-mono">#{iss.number}</span>
                              {iss.labels.map((l) => (
                                <span
                                  key={l.name}
                                  className="text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/60 text-muted-foreground"
                                >
                                  {l.name}
                                </span>
                              ))}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              #{iss.number} opened {formatRelativeTime(iss.created_at)} by {iss.user.login}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setConnectModal({
                                isOpen: true,
                                sourceType: "github_issue",
                                sourceId: `${repository.full_name}#${iss.number}`,
                                sourceTitle: `#${iss.number}: ${iss.title}`,
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
                                entityType: "github_issue",
                                entityId: `${repository.full_name}#${iss.number}`,
                                entityTitle: `#${iss.number}: ${iss.title}`,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            Discuss
                          </button>
                          <a
                            href={iss.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: COMMITS */}
            {activeTab === "commits" && (
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {commits.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <GitCommit className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-medium">No commits found</p>
                  </div>
                ) : (
                  commits.map((c) => (
                    <div key={c.sha} className="p-3.5 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        {c.author?.avatar_url ? (
                          <img
                            src={c.author.avatar_url}
                            alt={c.commit.author.name}
                            className="h-6 w-6 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {c.commit.author.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-foreground font-medium truncate">
                            {c.commit.message.split("\n")[0]}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {c.commit.author.name} committed {formatRelativeTime(c.commit.author.date)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          {c.sha.slice(0, 7)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setConnectModal({
                              isOpen: true,
                              sourceType: "github_commit",
                              sourceId: `${repository.full_name}@${c.sha}`,
                              sourceTitle: `${c.sha.slice(0, 7)}: ${c.commit.message.split("\n")[0]}`,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          Connect
                        </button>
                        <a
                          href={c.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: RELEASES */}
            {activeTab === "releases" && (
              <div className="space-y-3">
                {releases.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                    <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-medium">No published releases found</p>
                  </div>
                ) : (
                  releases.map((rel) => (
                    <div key={rel.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-purple-500" />
                          <h4 className="font-semibold text-sm text-foreground">
                            {rel.name || rel.tag_name}
                          </h4>
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            {rel.tag_name}
                          </span>
                        </div>
                        <a
                          href={rel.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                        >
                          <span>View on GitHub</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Published {formatRelativeTime(rel.published_at || rel.created_at)} by {rel.author?.login || "Maintainer"}
                      </p>
                      {rel.body && (
                        <p className="text-xs text-foreground bg-muted/30 p-3 rounded-lg border border-border whitespace-pre-wrap">
                          {rel.body}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: CONTRIBUTORS */}
            {activeTab === "contributors" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {contributors.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-card text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={user.avatar_url}
                        alt={user.login}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <a
                          href={user.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-foreground hover:text-blue-500 truncate block"
                        >
                          {user.login}
                        </a>
                        <span className="text-[11px] text-muted-foreground">
                          {user.contributions} contributions
                        </span>
                      </div>
                    </div>
                    <a
                      href={user.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </>
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
