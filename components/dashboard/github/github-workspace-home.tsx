"use client";

import * as React from "react";
import {
  Github,
  GitPullRequest,
  AlertCircle,
  FolderGit2,
  Folder,
  FileText,
  FileCode,
  File,
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
  ChevronRight,
  GitCommit,
  GitBranch,
  Copy,
  Check,
  ChevronDown,
  BookOpen,
  ArrowLeft,
  CircleDot,
  GitMerge,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GitHubOverviewStats,
  GitHubRepository,
  GitHubActivityEvent,
  GitHubContentItem,
  GitHubPullRequest,
  GitHubIssue,
  GitHubFileContent,
} from "@/lib/integrations/github/types";
import {
  getGitHubOverviewAction,
  getGitHubRepositoriesAction,
  getRepositoryContentsAction,
  getRepositoryRecentActivityAction,
  getGitHubPullRequestsAction,
  getGitHubIssuesAction,
  getGitHubFileContentAction,
} from "@/lib/integrations/github/actions";
import { ConnectGitHubModal } from "./connect-github-modal";
import { GitHubCommentsDrawer } from "./github-comments-drawer";

interface GitHubWorkspaceHomeProps {
  initialOverview?: GitHubOverviewStats;
  initialRepositories?: GitHubRepository[];
  organizationId: string;
  defaultRepository?: string;
}

export function GitHubWorkspaceHome({
  initialOverview,
  initialRepositories = [],
  organizationId,
  defaultRepository,
}: GitHubWorkspaceHomeProps) {
  const [overview, setOverview] = React.useState<GitHubOverviewStats | undefined>(initialOverview);
  const [repositories, setRepositories] = React.useState<GitHubRepository[]>(initialRepositories);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isExpired, setIsExpired] = React.useState(false);

  // Active Repository & Selection Dropdown
  const [selectedRepo, setSelectedRepo] = React.useState<GitHubRepository | null>(() => {
    if (defaultRepository && initialRepositories.length > 0) {
      const match = initialRepositories.find(
        (r) =>
          r.full_name.toLowerCase() === defaultRepository.toLowerCase() ||
          r.name.toLowerCase() === defaultRepository.toLowerCase()
      );
      if (match) return match;
    }
    return initialRepositories.length > 0 ? initialRepositories[0] : null;
  });
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = React.useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = React.useState("");
  const [repoVisibilityFilter, setRepoVisibilityFilter] = React.useState<"all" | "private" | "public">("all");
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Left Side: File Explorer & In-App File Viewer
  const [currentPath, setCurrentPath] = React.useState("");
  const [contents, setContents] = React.useState<GitHubContentItem[]>([]);
  const [loadingContents, setLoadingContents] = React.useState(false);

  // In-App File Viewer state (Zero DB writes, 100% on demand via GitHub API)
  const [viewingFile, setViewingFile] = React.useState<{ path: string; name: string } | null>(null);
  const [fileContent, setFileContent] = React.useState<GitHubFileContent | null>(null);
  const [loadingFile, setLoadingFile] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [copiedFileCode, setCopiedFileCode] = React.useState(false);

  // Right Side: Scoped Repo Activity, Pulls, Issues & Tools
  const [rightTab, setRightTab] = React.useState<"activity" | "pulls" | "issues" | "tools">("activity");
  const [repoActivity, setRepoActivity] = React.useState<GitHubActivityEvent[]>([]);
  const [loadingActivity, setLoadingActivity] = React.useState(false);
  const [repoPulls, setRepoPulls] = React.useState<GitHubPullRequest[]>([]);
  const [loadingPulls, setLoadingPulls] = React.useState(false);
  const [repoIssues, setRepoIssues] = React.useState<GitHubIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = React.useState(false);

  // Copied clone URL state
  const [copiedClone, setCopiedClone] = React.useState(false);
  const [avatarError, setAvatarError] = React.useState(false);

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

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRepoDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset avatarError if accountAvatar changes
  React.useEffect(() => {
    setAvatarError(false);
  }, [overview?.accountAvatar]);

  // Sync selectedRepo if initialRepositories changes
  React.useEffect(() => {
    if (!selectedRepo && repositories.length > 0) {
      setSelectedRepo(repositories[0]);
    }
  }, [repositories, selectedRepo]);

  // Load Repo Contents & README when selectedRepo or currentPath changes
  React.useEffect(() => {
    const repo = selectedRepo;
    if (!repo) return;
    const targetOwner = repo.owner.login;
    const targetName = repo.name;

    let isMounted = true;
    async function fetchContents() {
      setLoadingContents(true);
      try {
        const res = await getRepositoryContentsAction(
          targetOwner,
          targetName,
          currentPath,
          organizationId
        );
        if (isMounted) {
          if (res.authExpired) setIsExpired(true);
          if (res.success) setContents(res.contents);
        }
      } finally {
        if (isMounted) setLoadingContents(false);
      }
    }

    fetchContents();
    return () => {
      isMounted = false;
    };
  }, [selectedRepo, currentPath, organizationId]);

  // Fetch file content on demand when opened (Zero DB persistence)
  const handleOpenFile = React.useCallback(
    async (item: GitHubContentItem) => {
      if (!selectedRepo) return;
      setViewingFile({ path: item.path, name: item.name });
      setLoadingFile(true);
      setFileError(null);
      setFileContent(null);
      try {
        const res = await getGitHubFileContentAction(
          selectedRepo.owner.login,
          selectedRepo.name,
          item.path,
          organizationId
        );
        if (res.authExpired) {
          setIsExpired(true);
        }
        if (res.success && res.file) {
          setFileContent(res.file);
        } else {
          setFileError(res.error || "Failed to load file content from repository.");
        }
      } catch (err: any) {
        setFileError(err?.message || "Failed to fetch file content.");
      } finally {
        setLoadingFile(false);
      }
    },
    [selectedRepo, organizationId]
  );

  // Load Repo Activity when selectedRepo changes or Activity tab is active
  React.useEffect(() => {
    const repo = selectedRepo;
    if (!repo) return;
    const targetOwner = repo.owner.login;
    const targetName = repo.name;

    let isMounted = true;
    async function fetchActivity() {
      setLoadingActivity(true);
      try {
        const res = await getRepositoryRecentActivityAction(
          targetOwner,
          targetName,
          organizationId
        );
        if (isMounted) {
          if (res.authExpired) setIsExpired(true);
          if (res.success) setRepoActivity(res.events);
        }
      } finally {
        if (isMounted) setLoadingActivity(false);
      }
    }

    fetchActivity();
    return () => {
      isMounted = false;
    };
  }, [selectedRepo, organizationId]);

  // Load Pulls when selectedRepo changes and tab is pulls
  React.useEffect(() => {
    const repo = selectedRepo;
    if (!repo || rightTab !== "pulls") return;
    const targetOwner = repo.owner.login;
    const targetName = repo.name;

    let isMounted = true;
    async function fetchPulls() {
      setLoadingPulls(true);
      try {
        const res = await getGitHubPullRequestsAction(
          targetOwner,
          targetName,
          { state: "all" },
          organizationId
        );
        if (isMounted) {
          if (res.authExpired) setIsExpired(true);
          if (res.success) setRepoPulls(res.pullRequests);
        }
      } finally {
        if (isMounted) setLoadingPulls(false);
      }
    }

    fetchPulls();
    return () => {
      isMounted = false;
    };
  }, [selectedRepo, rightTab, organizationId]);

  // Load Issues when selectedRepo changes and tab is issues
  React.useEffect(() => {
    const repo = selectedRepo;
    if (!repo || rightTab !== "issues") return;
    const targetOwner = repo.owner.login;
    const targetName = repo.name;

    let isMounted = true;
    async function fetchIssues() {
      setLoadingIssues(true);
      try {
        const res = await getGitHubIssuesAction(
          targetOwner,
          targetName,
          { state: "all" },
          organizationId
        );
        if (isMounted) {
          if (res.authExpired) setIsExpired(true);
          if (res.success) setRepoIssues(res.issues);
        }
      } finally {
        if (isMounted) setLoadingIssues(false);
      }
    }

    fetchIssues();
    return () => {
      isMounted = false;
    };
  }, [selectedRepo, rightTab, organizationId]);

  // Global Refresh Handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [ovRes, repoRes] = await Promise.all([
        getGitHubOverviewAction(organizationId),
        getGitHubRepositoriesAction(organizationId),
      ]);
      if (ovRes.authExpired || repoRes.authExpired) {
        setIsExpired(true);
      } else {
        setIsExpired(false);
      }
      if (ovRes.success && ovRes.data) {
        setOverview(ovRes.data);
      }
      if (repoRes.success) {
        setRepositories(repoRes.repositories);
        if (selectedRepo) {
          const updated = repoRes.repositories.find((r) => r.id === selectedRepo.id);
          if (updated) setSelectedRepo(updated);
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const privateCount = React.useMemo(() => repositories.filter((r) => r.private).length, [repositories]);
  const publicCount = React.useMemo(() => repositories.filter((r) => !r.private).length, [repositories]);

  // Filtered repos for dropdown search and visibility tabs
  const filteredDropdownRepos = React.useMemo(() => {
    let list = repositories;
    if (repoVisibilityFilter === "private") {
      list = list.filter((r) => r.private);
    } else if (repoVisibilityFilter === "public") {
      list = list.filter((r) => !r.private);
    }

    if (!repoSearchQuery.trim()) return list;
    const q = repoSearchQuery.toLowerCase().trim();
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [repositories, repoSearchQuery, repoVisibilityFilter]);

  // Breadcrumbs path parts
  const pathParts = React.useMemo(() => {
    if (!currentPath) return [];
    return currentPath.split("/").filter(Boolean);
  }, [currentPath]);

  const handleNavigateFolder = (folderName: string) => {
    setViewingFile(null);
    setFileContent(null);
    setFileError(null);
    setCurrentPath((prev) => (prev ? `${prev}/${folderName}` : folderName));
  };

  const handleNavigateBreadcrumb = (index: number) => {
    setViewingFile(null);
    setFileContent(null);
    setFileError(null);
    if (index === -1) {
      setCurrentPath("");
    } else {
      const newPath = pathParts.slice(0, index + 1).join("/");
      setCurrentPath(newPath);
    }
  };

  const handleCopyCloneUrl = () => {
    if (!selectedRepo) return;
    const url = selectedRepo.clone_url || selectedRepo.html_url;
    navigator.clipboard.writeText(url);
    setCopiedClone(true);
    setTimeout(() => setCopiedClone(false), 2000);
  };

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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderFileIcon = (item: GitHubContentItem) => {
    if (item.type === "dir") {
      return <Folder className="h-4 w-4 text-blue-500 fill-blue-500/20 shrink-0" />;
    }
    const ext = item.name.split(".").pop()?.toLowerCase();
    if (["ts", "tsx", "js", "jsx", "py", "go", "rs", "java", "c", "cpp", "json", "sql"].includes(ext || "")) {
      return <FileCode className="h-4 w-4 text-emerald-500 shrink-0" />;
    }
    if (["md", "txt", "doc", "pdf"].includes(ext || "")) {
      return <FileText className="h-4 w-4 text-amber-500 shrink-0" />;
    }
    return <File className="h-4 w-4 text-zinc-400 shrink-0" />;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground flex flex-col min-h-screen">
      {/* ========================================================================= */}
      {/* UNIFIED PROFESSIONAL HEADER: Clean repository selector, status & actions */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-30 border-b border-border bg-background px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: GitHub icon & Opaque Repository Selector */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xs shrink-0">
              <Github className="h-4 w-4" />
            </div>

            {/* Dropdown Selector */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsRepoDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card hover:bg-muted/60 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors shadow-2xs"
              >
                <FolderGit2 className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="font-mono text-xs">
                  {selectedRepo ? `${selectedRepo.owner.login} / ${selectedRepo.name}` : "Select Repository..."}
                </span>
                {selectedRepo && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground uppercase font-sans">
                    {selectedRepo.private ? "Private" : "Public"}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
                    isRepoDropdownOpen && "rotate-180"
                  )}
                />
              </button>

              {/* Dropdown Menu Modal with 100% SOLID OPAQUE BACKGROUND */}
              {isRepoDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-88 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-2.5 text-foreground shadow-2xl z-50 animate-in fade-in-0 zoom-in-95">
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={repoSearchQuery}
                      onChange={(e) => setRepoSearchQuery(e.target.value)}
                      placeholder="Filtrar repositórios..."
                      autoFocus
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Filter Pills: Todos / Privados / Públicos */}
                  <div className="flex items-center gap-1 mb-2 px-0.5">
                    <button
                      type="button"
                      onClick={() => setRepoVisibilityFilter("all")}
                      className={cn(
                        "px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer",
                        repoVisibilityFilter === "all"
                          ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Todos ({repositories.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepoVisibilityFilter("private")}
                      className={cn(
                        "px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer",
                        repoVisibilityFilter === "private"
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Lock className="h-3 w-3" />
                      Privados ({privateCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepoVisibilityFilter("public")}
                      className={cn(
                        "px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer",
                        repoVisibilityFilter === "public"
                          ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Globe className="h-3 w-3" />
                      Públicos ({publicCount})
                    </button>
                  </div>

                  {/* Notice if 0 private repos found */}
                  {privateCount === 0 && (
                    <div className="mb-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        <span>Apenas repositórios públicos visíveis?</span>
                      </div>
                      <p className="text-[10px] leading-relaxed text-amber-800/80 dark:text-amber-300/80">
                        Para o GitHub autorizar repositórios privados da sua conta ou organização, reconecte a integração com permissão total (scope <code className="bg-amber-500/20 px-1 rounded font-mono">repo</code>).
                      </p>
                      <a
                        href={`/api/integrations/github/connect?returnUrl=${encodeURIComponent("/dashboard/github")}`}
                        className="inline-flex items-center gap-1 font-semibold text-[10px] text-blue-600 dark:text-blue-400 hover:underline pt-0.5"
                      >
                        <span>Reconectar com acesso a privados</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {filteredDropdownRepos.length === 0 ? (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        No matching repositories found.
                      </div>
                    ) : (
                      filteredDropdownRepos.map((repo) => {
                        const isCurrent = selectedRepo?.id === repo.id;
                        return (
                          <button
                            key={repo.id}
                            type="button"
                            onClick={() => {
                              setSelectedRepo(repo);
                              setCurrentPath("");
                              setViewingFile(null);
                              setFileContent(null);
                              setFileError(null);
                              setIsRepoDropdownOpen(false);
                              setRepoSearchQuery("");
                            }}
                            className={cn(
                              "w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors",
                              isCurrent
                                ? "bg-blue-600 text-white font-medium"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-foreground"
                            )}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-mono text-xs font-semibold truncate">{repo.name}</p>
                              <p
                                className={cn(
                                  "text-[10px] truncate",
                                  isCurrent ? "text-blue-100" : "text-muted-foreground"
                                )}
                              >
                                {repo.owner.login}
                              </p>
                            </div>
                            {repo.private ? (
                              <Lock
                                className={cn(
                                  "h-3 w-3 shrink-0",
                                  isCurrent ? "text-white" : "text-muted-foreground"
                                )}
                              />
                            ) : (
                              <Globe
                                className={cn(
                                  "h-3 w-3 shrink-0",
                                  isCurrent ? "text-white" : "text-muted-foreground"
                                )}
                              />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Metadata badges for selected repo */}
            {selectedRepo && (
              <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <GitBranch className="h-3 w-3 text-muted-foreground" />
                  {selectedRepo.default_branch || "main"}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-[11px]">
                  <Star className="h-3 w-3 text-amber-500" />
                  {selectedRepo.stargazers_count}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-[11px]">
                  <GitFork className="h-3 w-3 text-blue-500" />
                  {selectedRepo.forks_count}
                </span>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {selectedRepo && (
              <button
                type="button"
                onClick={handleCopyCloneUrl}
                className="hidden sm:flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-2xs"
                title="Copy clone URL"
              >
                {copiedClone ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-500 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 opacity-70" />
                    <span>Clone</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 shadow-2xs"
              title="Sync with GitHub"
            >
              <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
              <span>Sync</span>
            </button>

            {selectedRepo?.html_url && (
              <a
                href={selectedRepo.html_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-2xs"
                title="Open repository on GitHub"
              >
                <span>GitHub</span>
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Expiration Banner if token expired */}
      {isExpired && (
        <div className="mx-6 mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Your GitHub connection has expired or was revoked. Reconnect to resume live synchronization.</span>
          </div>
          <a
            href={`/api/integrations/github/connect?returnUrl=${encodeURIComponent("/dashboard/github")}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black px-3 py-1 text-xs font-semibold transition-colors shrink-0"
          >
            <span>Reconnect GitHub</span>
            <RefreshCw className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN TWO-COLUMN SPLIT LAYOUT: Left Side (In-App File Explorer/Viewer) / Right Side (Scoped Activity) */}
      {/* ========================================================================= */}
      {!selectedRepo ? (
        <div className="flex-1 flex items-center justify-center p-12 text-center text-muted-foreground">
          <div>
            <FolderGit2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-semibold text-foreground">No Repositories Available</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Connect your GitHub organization to view workspaces and files.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
          {/* ========================================================================= */}
          {/* LEFT SIDE (7 Cols): Repository File Tree OR In-App File Viewer */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 space-y-4">
            {viewingFile ? (
              /* ================= IN-APP FILE CONTENT VIEWER (Zero DB writes) ================= */
              <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
                {/* Viewer Top Bar */}
                <div className="bg-muted/40 border-b border-border px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setViewingFile(null);
                        setFileContent(null);
                        setFileError(null);
                      }}
                      className="font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 py-0.5 px-2 rounded hover:bg-muted"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back to files</span>
                    </button>

                    <span className="text-muted-foreground font-mono">/</span>

                    <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground truncate">
                      <FileCode className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">{viewingFile.path}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {fileContent && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {formatFileSize(fileContent.size)}
                      </span>
                    )}

                    {fileContent && !fileContent.isBinary && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(fileContent.content);
                          setCopiedFileCode(true);
                          setTimeout(() => setCopiedFileCode(false), 2000);
                        }}
                        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium border border-border bg-background hover:bg-muted transition-colors shadow-2xs"
                        title="Copy file code"
                      >
                        {copiedFileCode ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-500" />
                            <span className="text-emerald-500 font-semibold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 opacity-70" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}

                    {fileContent?.html_url && (
                      <a
                        href={fileContent.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors p-1"
                        title="View on GitHub"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Content Body */}
                {loadingFile ? (
                  <div className="p-12 flex flex-col items-center justify-center text-muted-foreground text-xs gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    <span>Fetching file directly from GitHub API...</span>
                  </div>
                ) : fileError ? (
                  <div className="p-8 text-center space-y-3">
                    <AlertCircle className="h-6 w-6 text-amber-500 mx-auto" />
                    <p className="text-xs text-foreground font-semibold">{fileError}</p>
                    <button
                      type="button"
                      onClick={() =>
                        viewingFile &&
                        handleOpenFile({ path: viewingFile.path, name: viewingFile.name } as any)
                      }
                      className="rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-3 py-1.5 text-xs font-semibold"
                    >
                      Retry
                    </button>
                  </div>
                ) : fileContent?.isBinary ? (
                  <div className="p-12 text-center text-muted-foreground space-y-3">
                    <File className="h-8 w-8 mx-auto opacity-40" />
                    <p className="text-xs font-semibold text-foreground">Binary file</p>
                    <p className="text-[11px] text-muted-foreground">
                      This file format cannot be previewed as text ({formatFileSize(fileContent.size)}).
                    </p>
                    {fileContent.html_url && (
                      <a
                        href={fileContent.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
                      >
                        <span>Open on GitHub</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ) : fileContent ? (
                  <div className="overflow-x-auto max-h-[720px] overflow-y-auto bg-zinc-950 text-zinc-100 p-4 font-mono text-xs leading-relaxed select-text">
                    <table className="w-full border-collapse">
                      <tbody>
                        {fileContent.content.split("\n").map((line, idx) => (
                          <tr key={idx} className="hover:bg-zinc-900/60 transition-colors">
                            <td className="w-12 select-none pr-4 text-right text-zinc-600 dark:text-zinc-500 text-[11px] align-top">
                              {idx + 1}
                            </td>
                            <td className="whitespace-pre font-mono text-[12px] text-zinc-200">
                              {line || " "}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : (
              /* ================= REPO FILE TREE LIST ================= */
              <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
                {/* Explorer Header / Breadcrumb navigation */}
                <div className="bg-muted/40 border-b border-border px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <button
                      type="button"
                      onClick={() => handleNavigateBreadcrumb(-1)}
                      className="font-semibold text-foreground hover:text-blue-500 transition-colors flex items-center gap-1"
                    >
                      <FolderGit2 className="h-3.5 w-3.5 text-blue-500" />
                      <span>{selectedRepo.name}</span>
                    </button>

                    {pathParts.map((part, idx) => (
                      <React.Fragment key={part}>
                        <span className="text-muted-foreground font-mono">/</span>
                        <button
                          type="button"
                          onClick={() => handleNavigateBreadcrumb(idx)}
                          className={cn(
                            "transition-colors",
                            idx === pathParts.length - 1
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {part}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Back folder button if nested */}
                  {pathParts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleNavigateBreadcrumb(pathParts.length - 2)}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 px-2 py-0.5 rounded hover:bg-muted transition-colors"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      <span>Up</span>
                    </button>
                  )}
                </div>

                {/* File Listing Table */}
                {loadingContents ? (
                  <div className="p-8 flex items-center justify-center text-muted-foreground text-xs gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span>Loading repository files...</span>
                  </div>
                ) : contents.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-xs">
                    Empty directory or no accessible files.
                  </div>
                ) : (
                  <div className="divide-y divide-border text-xs">
                    {contents.map((item) => (
                      <div
                        key={item.sha || item.name}
                        className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {renderFileIcon(item)}
                          {item.type === "dir" ? (
                            <button
                              type="button"
                              onClick={() => handleNavigateFolder(item.name)}
                              className="font-medium text-foreground hover:text-blue-500 transition-colors truncate text-left"
                            >
                              {item.name}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenFile(item)}
                              className="font-normal text-foreground hover:text-blue-500 transition-colors truncate text-left"
                            >
                              {item.name}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-muted-foreground shrink-0 text-[11px]">
                          {item.size ? <span>{formatFileSize(item.size)}</span> : null}
                          {item.type === "file" && (
                            <button
                              type="button"
                              onClick={() => handleOpenFile(item)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-foreground"
                              title="Open in App"
                            >
                              <FileCode className="h-3 w-3 text-blue-500" />
                            </button>
                          )}
                          <a
                            href={item.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-foreground"
                            title="Open on GitHub"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* RIGHT SIDE (5 Cols): Scoped Repository Activity, Pulls, Issues & Brain Tools */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 space-y-4">
            {/* Action Bar: Brain Integrations (Connect Object & Discussion) */}
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  setConnectModal({
                    isOpen: true,
                    sourceType: "github_repo",
                    sourceId: selectedRepo.full_name,
                    sourceTitle: selectedRepo.name,
                  })
                }
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors"
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
                    entityId: selectedRepo.full_name,
                    entityTitle: selectedRepo.name,
                  })
                }
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5 text-purple-500" />
                <span>Discussion</span>
              </button>
            </div>

            {/* Tabs for Right Column */}
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="border-b border-border bg-muted/20 flex items-center p-1 gap-1 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setRightTab("activity")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-center transition-colors",
                    rightTab === "activity"
                      ? "bg-blue-600 text-white font-semibold shadow-2xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  Activity ({repoActivity.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("pulls")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-center transition-colors",
                    rightTab === "pulls"
                      ? "bg-blue-600 text-white font-semibold shadow-2xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  PRs
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("issues")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-center transition-colors",
                    rightTab === "issues"
                      ? "bg-blue-600 text-white font-semibold shadow-2xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  Issues
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("tools")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-center transition-colors",
                    rightTab === "tools"
                      ? "bg-blue-600 text-white font-semibold shadow-2xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  Info
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-4 max-h-[600px] overflow-y-auto">
                {/* 1. REPOSITORY RECENT ACTIVITY (Scoped to selectedRepo!) */}
                {rightTab === "activity" && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Recent Activity in {selectedRepo.name}
                    </p>

                    {loadingActivity ? (
                      <div className="py-8 flex items-center justify-center text-muted-foreground text-xs gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        <span>Loading repository activity...</span>
                      </div>
                    ) : repoActivity.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground text-xs">
                        No recent commits or activity recorded for this repository.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {repoActivity.map((ev) => (
                          <div
                            key={ev.id}
                            className="p-3 rounded-lg border border-border bg-background flex items-start gap-2.5 text-xs"
                          >
                            <div className="mt-0.5">
                              {ev.type.startsWith("pr") ? (
                                <GitPullRequest className="h-4 w-4 text-blue-500" />
                              ) : ev.type.startsWith("issue") ? (
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                              ) : (
                                <GitCommit className="h-4 w-4 text-emerald-500" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <a
                                href={ev.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-foreground hover:text-blue-500 transition-colors line-clamp-1 block"
                              >
                                {ev.title}
                              </a>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span>{ev.actor.login}</span>
                                <span>•</span>
                                <span>{formatRelativeTime(ev.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. REPOSITORY PULL REQUESTS */}
                {rightTab === "pulls" && (
                  <div className="space-y-2.5">
                    {loadingPulls ? (
                      <div className="py-8 flex items-center justify-center text-muted-foreground text-xs gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        <span>Loading pull requests...</span>
                      </div>
                    ) : repoPulls.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground text-xs">
                        No pull requests found for this repository.
                      </div>
                    ) : (
                      repoPulls.map((pr) => (
                        <div
                          key={pr.id}
                          className="p-3 rounded-lg border border-border bg-background flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="mt-0.5">
                              {pr.merged ? (
                                <GitMerge className="h-4 w-4 text-purple-500" />
                              ) : pr.state === "open" ? (
                                <GitPullRequest className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <GitPullRequest className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                            <div className="min-w-0 space-y-0.5">
                              <a
                                href={pr.html_url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-foreground hover:text-blue-500 transition-colors line-clamp-1"
                              >
                                {pr.title}
                              </a>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                #{pr.number} by {pr.user.login} • {formatRelativeTime(pr.updated_at || pr.created_at)}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setConnectModal({
                                isOpen: true,
                                sourceType: "github_pr",
                                sourceId: `${selectedRepo.full_name}#${pr.number}`,
                                sourceTitle: `#${pr.number}: ${pr.title}`,
                              })
                            }
                            className="px-2 py-1 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          >
                            Link
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 3. REPOSITORY ISSUES */}
                {rightTab === "issues" && (
                  <div className="space-y-2.5">
                    {loadingIssues ? (
                      <div className="py-8 flex items-center justify-center text-muted-foreground text-xs gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                        <span>Loading issues...</span>
                      </div>
                    ) : repoIssues.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground text-xs">
                        No open issues found for this repository.
                      </div>
                    ) : (
                      repoIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="p-3 rounded-lg border border-border bg-background flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <CircleDot className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            <div className="min-w-0 space-y-0.5">
                              <a
                                href={issue.html_url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-foreground hover:text-blue-500 transition-colors line-clamp-1"
                              >
                                {issue.title}
                              </a>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                #{issue.number} by {issue.user.login} • {formatRelativeTime(issue.updated_at || issue.created_at)}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setConnectModal({
                                isOpen: true,
                                sourceType: "github_issue",
                                sourceId: `${selectedRepo.full_name}#${issue.number}`,
                                sourceTitle: `#${issue.number}: ${issue.title}`,
                              })
                            }
                            className="px-2 py-1 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          >
                            Link
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 4. REPOSITORY INFO & CLONE */}
                {rightTab === "tools" && (
                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="text-[11px] text-muted-foreground block mb-1">Clone URL (HTTPS)</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          readOnly
                          value={selectedRepo.clone_url || selectedRepo.html_url}
                          className="w-full rounded-lg border border-input bg-muted/40 px-3 py-1.5 font-mono text-xs text-foreground select-all"
                        />
                        <button
                          type="button"
                          onClick={handleCopyCloneUrl}
                          className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                          title="Copy clone URL"
                        >
                          {copiedClone ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-lg border border-border bg-background">
                        <span className="text-[10px] text-muted-foreground block">Primary Language</span>
                        <span className="font-semibold text-xs text-foreground flex items-center gap-1.5 mt-1">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          {selectedRepo.language || "Not specified"}
                        </span>
                      </div>

                      <div className="p-3 rounded-lg border border-border bg-background">
                        <span className="text-[10px] text-muted-foreground block">Default Branch</span>
                        <span className="font-semibold font-mono text-xs text-foreground mt-1 block">
                          {selectedRepo.default_branch || "main"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="text-[10px] text-muted-foreground block mb-1">Description</span>
                      <p className="text-xs text-muted-foreground leading-relaxed bg-background p-3 rounded-lg border border-border">
                        {selectedRepo.description || "No description provided for this repository."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connect Object Modal */}
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
