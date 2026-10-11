// ==============================================================================
// Company Brain: GitHub Integration Types
// ==============================================================================

export interface GitHubViewer {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  public_repos: number;
  total_private_repos?: number;
  organizations?: {
    login: string;
    avatar_url: string;
  }[];
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  clone_url?: string;
  visibility?: "public" | "private" | "internal";
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  merged: boolean;
  merged_at: string | null;
  html_url: string;
  body: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  draft: boolean;
  user: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  labels: {
    id: number;
    name: string;
    color: string;
  }[];
  head: {
    ref: string;
  };
  base: {
    ref: string;
  };
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  body: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  is_pull_request: boolean;
  user: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  assignees: {
    login: string;
    avatar_url: string;
  }[];
  labels: {
    id: number;
    name: string;
    color: string;
  }[];
}

export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
    html_url: string;
  } | null;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  created_at: string;
  author: {
    login: string;
    avatar_url: string;
  } | null;
}

export interface GitHubContributor {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

export interface GitHubActivityEvent {
  id: string;
  type: "pr_opened" | "pr_merged" | "issue_opened" | "issue_closed" | "commit_pushed" | "release_published";
  actor: {
    login: string;
    avatar_url: string;
  };
  repoName: string;
  title: string;
  url: string;
  number?: number;
  timestamp: string;
}

export interface GitHubOverviewStats {
  connectedAccount: string;
  accountAvatar: string;
  accountUrl: string;
  repositoriesCount: number;
  openPullRequestsCount: number;
  openIssuesCount: number;
  recentReleasesCount: number;
  recentActivity: GitHubActivityEvent[];
}

export interface EntityCommentRecord {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  author_id: string;
  parent_id?: string | null;
  content: string;
  is_resolved: boolean;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir" | "symlink" | "submodule";
  html_url: string;
  download_url: string | null;
}

export interface GitHubReadme {
  name: string;
  content: string;
  html_url: string;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  html_url: string;
  download_url?: string | null;
  isBinary?: boolean;
}

export type GitHubDiagnosticStatus =
  | "ok"
  | "app_not_installed"
  | "app_installed_limited_access"
  | "insufficient_permissions"
  | "auth_expired"
  | "rate_limit_exceeded"
  | "api_error"
  | "no_repositories";

export interface GitHubAppInstallationInfo {
  id: number;
  accountLogin: string;
  repositorySelection: "all" | "selected";
}

export interface GitHubRepositoryListResult {
  repositories: GitHubRepository[];
  diagnosticStatus: GitHubDiagnosticStatus;
  diagnosticMessage?: string;
  isPartial: boolean;
  installationsCount: number;
  installations: GitHubAppInstallationInfo[];
  appInstallUrl?: string;
}
