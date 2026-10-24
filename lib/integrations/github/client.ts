// ==============================================================================
// Company Brain: GitHub Server-Side API Client
// Secure, scoped, decrypted-token requests with rate-limiting & SSRF protection
// ==============================================================================

import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto/encryption";
import { logger } from "@/lib/security/logger";
import { GITHUB_API_BASE_URL, getGitHubConfig } from "./config";
import {
  GitHubViewer,
  GitHubRepository,
  GitHubPullRequest,
  GitHubIssue,
  GitHubCommit,
  GitHubRelease,
  GitHubContributor,
  GitHubActivityEvent,
  GitHubContentItem,
  GitHubReadme,
  GitHubFileContent,
  GitHubRepositoryListResult,
  GitHubDiagnosticStatus,
  GitHubAppInstallationInfo,
} from "./types";

/**
 * Retrieves the decrypted access token for the active organization's GitHub integration.
 * Strictly scoped to the specified tenant organization. No global or ambient fallbacks.
 */
export async function getDecryptedGitHubToken(organizationId: string): Promise<{
  accessToken: string;
  accountLogin: string;
  accountEmail?: string;
} | null> {
  const supabase = await createClient();

  const { data: integration, error } = await supabase
    .from("organization_integrations")
    .select("id, encrypted_access_token, provider_account_id, account_email, metadata, status")
    .eq("organization_id", organizationId)
    .eq("provider", "github")
    .eq("status", "connected")
    .maybeSingle();

  if (error || !integration || !integration.encrypted_access_token) {
    return null;
  }

  try {
    const accessToken = decryptToken(integration.encrypted_access_token);
    return {
      accessToken,
      accountLogin: ((integration.metadata as any)?.github_login) || integration.provider_account_id,
      accountEmail: integration.account_email || undefined,
    };
  } catch (err) {
    logger.error("Failed to decrypt GitHub access token", err, { organizationId });
    return null;
  }
}

export class GitHubAuthExpiredError extends Error {
  constructor(message = "GitHub authentication token is expired or revoked.") {
    super(message);
    this.name = "GitHubAuthExpiredError";
  }
}

export class GitHubForbiddenError extends Error {
  constructor(message = "GitHub API access forbidden: insufficient permissions.") {
    super(message);
    this.name = "GitHubForbiddenError";
  }
}

export class GitHubNotFoundError extends Error {
  constructor(message = "GitHub resource not found.") {
    super(message);
    this.name = "GitHubNotFoundError";
  }
}

export class GitHubRateLimitError extends Error {
  public resetTime?: number;
  constructor(message = "GitHub API rate limit exceeded.", resetTime?: number) {
    super(message);
    this.name = "GitHubRateLimitError";
    this.resetTime = resetTime;
  }
}

/**
 * Secure fetch wrapper for GitHub REST API with SSRF protection.
 * Strictly uses tenant's decrypted token. Never falls back to ambient PAT.
 */
async function githubFetch<T>(
  organizationId: string,
  endpoint: string,
  init?: RequestInit
): Promise<T> {
  // Enforce SSRF protection: only permit requests to official GitHub API domain
  if (!endpoint.startsWith("/") && !endpoint.startsWith(GITHUB_API_BASE_URL)) {
    throw new Error("Invalid GitHub API request URL: SSRF protection violation.");
  }

  const tokenData = await getDecryptedGitHubToken(organizationId);
  if (!tokenData) {
    throw new GitHubAuthExpiredError("GitHub integration is not connected or token is unavailable.");
  }

  const url = endpoint.startsWith("http") ? endpoint : `${GITHUB_API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenData.accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "BusinessBrain-Enterprise-Integration",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.warn(`GitHub API request failed (${response.status}) on ${endpoint}`, {
      status: response.status,
      errorBody,
    });

    const isRateLimit =
      response.status === 429 ||
      (response.status === 403 &&
        (response.headers.get("x-ratelimit-remaining") === "0" ||
          errorBody.toLowerCase().includes("rate limit")));

    if (isRateLimit) {
      const resetHeader = response.headers.get("x-ratelimit-reset");
      const resetTime = resetHeader ? parseInt(resetHeader, 10) : undefined;
      throw new GitHubRateLimitError(
        `GitHub API rate limit exceeded (${response.status}): ${errorBody}`,
        resetTime
      );
    }

    if (response.status === 401) {
      try {
        const supabase = await createClient();
        await supabase
          .from("organization_integrations")
          .update({
            status: "disconnected",
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId)
          .eq("provider", "github");
      } catch (dbErr) {
        logger.warn("Failed to mark GitHub integration as disconnected after 401", { dbErr });
      }

      throw new GitHubAuthExpiredError(`GitHub API request failed (401): ${errorBody}`);
    }

    if (response.status === 403) {
      throw new GitHubForbiddenError(`GitHub API request forbidden (403): ${errorBody}`);
    }

    if (response.status === 404) {
      throw new GitHubNotFoundError(`GitHub API resource not found (404): ${errorBody}`);
    }

    throw new Error(`GitHub API request failed (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetches authenticated GitHub viewer profile and organizations.
 */
export async function getGitHubViewer(organizationId: string): Promise<GitHubViewer> {
  const user = await githubFetch<GitHubViewer>(organizationId, "/user");
  try {
    const orgs = await githubFetch<{ login: string; avatar_url: string }[]>(
      organizationId,
      "/user/orgs"
    );
    user.organizations = orgs;
  } catch {
    user.organizations = [];
  }
  return user;
}

/**
 * Detailed repository discovery for the connected organization.
 * Features:
 * - Multi-page pagination across /user/repos and all GitHub App installations
 * - Safe loop ceiling (max 10 pages / 1000 repos)
 * - Rate limit awareness with graceful partial result reporting
 * - Multi-installation traversal with per-installation repository pagination
 * - Deduplication and diagnostic status evaluation
 * - Zero fallback to ambient PAT
 */
export async function listRepositoriesDetails(
  organizationId: string,
  options?: {
    page?: number;
    per_page?: number;
    sort?: "updated" | "pushed" | "full_name";
    direction?: "asc" | "desc";
    type?: "all" | "owner" | "public" | "private" | "member";
    visibility?: "all" | "public" | "private";
    affiliation?: string;
  }
): Promise<GitHubRepositoryListResult> {
  const perPage = Math.min(options?.per_page || 100, 100);
  const sort = options?.sort || "updated";
  const direction = options?.direction || "desc";

  const allRepos: GitHubRepository[] = [];
  const installations: GitHubAppInstallationInfo[] = [];
  let isPartial = false;
  let diagnosticStatus: GitHubDiagnosticStatus = "ok";
  let diagnosticMessage: string | undefined;

  const cfg = getGitHubConfig();
  const appInstallUrl = cfg.appSlug
    ? `https://github.com/apps/${cfg.appSlug}/installations/new`
    : "https://github.com/settings/installations";

  // Step 1: Query /user/repos with pagination
  const baseParams = new URLSearchParams({
    per_page: String(perPage),
    sort,
    direction,
  });

  if (options?.visibility) {
    baseParams.set("visibility", options.visibility);
    baseParams.set("affiliation", options?.affiliation || "owner,collaborator,organization_member");
  } else if (options?.type && options.type !== "all") {
    baseParams.set("type", options.type);
  } else {
    baseParams.set("visibility", "all");
    baseParams.set("affiliation", options?.affiliation || "owner,collaborator,organization_member");
  }

  let currentPage = options?.page || 1;
  const maxPages = options?.page ? options.page : 10;

  try {
    while (currentPage <= maxPages) {
      baseParams.set("page", String(currentPage));
      try {
        const pageData = await githubFetch<GitHubRepository[]>(
          organizationId,
          `/user/repos?${baseParams.toString()}`
        );

        if (!Array.isArray(pageData) || pageData.length === 0) break;
        allRepos.push(...pageData);

        if (pageData.length < perPage || options?.page) break;
        currentPage++;
      } catch (pageErr: any) {
        if (pageErr instanceof GitHubAuthExpiredError) {
          throw pageErr;
        }
        if (pageErr instanceof GitHubRateLimitError) {
          isPartial = true;
          diagnosticStatus = allRepos.length > 0 ? "ok" : "rate_limit_exceeded";
          diagnosticMessage = "Limite de pedidos atingido na API do GitHub.";
          break;
        }
        if (currentPage === 1 && !options?.page) {
          if (pageErr instanceof GitHubForbiddenError) {
            diagnosticStatus = "insufficient_permissions";
            diagnosticMessage = "Permissões insuficientes para consultar /user/repos.";
          } else {
            isPartial = true;
          }
        } else {
          isPartial = true;
        }
        break;
      }
    }
  } catch (err: any) {
    if (err instanceof GitHubAuthExpiredError) {
      return {
        repositories: [],
        diagnosticStatus: "auth_expired",
        diagnosticMessage: "Sessão GitHub expirada ou revogada.",
        isPartial: false,
        installationsCount: 0,
        installations: [],
        appInstallUrl,
      };
    }
    throw err;
  }

  // Step 2: Query GitHub App installations (/user/installations) with pagination
  try {
    let instPage = 1;
    const maxInstPages = 5;
    const rawInstallations: Array<{ id: number; account?: { login?: string }; repository_selection?: "all" | "selected" }> = [];

    while (instPage <= maxInstPages) {
      try {
        const instRes = await githubFetch<{
          total_count: number;
          installations: Array<{ id: number; account?: { login?: string }; repository_selection?: "all" | "selected" }>;
        }>(organizationId, `/user/installations?per_page=100&page=${instPage}`);

        if (instRes?.installations && Array.isArray(instRes.installations) && instRes.installations.length > 0) {
          rawInstallations.push(...instRes.installations);
          if (instRes.installations.length < 100) break;
          instPage++;
        } else {
          break;
        }
      } catch (instFetchErr: any) {
        if (instFetchErr instanceof GitHubRateLimitError) {
          isPartial = true;
        }
        break;
      }
    }

    for (const inst of rawInstallations) {
      const selection = inst.repository_selection || "all";
      installations.push({
        id: inst.id,
        accountLogin: inst.account?.login || `installation-${inst.id}`,
        repositorySelection: selection,
      });

      // Step 3: Query repositories for this installation with pagination
      let instRepoPage = 1;
      const maxInstRepoPages = 10;
      while (instRepoPage <= maxInstRepoPages) {
        try {
          const instReposData = await githubFetch<{
            total_count: number;
            repository_selection?: string;
            repositories: GitHubRepository[];
          }>(organizationId, `/user/installations/${inst.id}/repositories?per_page=100&page=${instRepoPage}`);

          if (instReposData?.repositories && Array.isArray(instReposData.repositories) && instReposData.repositories.length > 0) {
            allRepos.push(...instReposData.repositories);
            if (instReposData.repositories.length < 100) break;
            instRepoPage++;
          } else {
            break;
          }
        } catch (instRepoErr: any) {
          if (instRepoErr instanceof GitHubRateLimitError) {
            isPartial = true;
          } else {
            logger.warn("Failed to fetch installation repositories", { installationId: inst.id, page: instRepoPage, instRepoErr });
          }
          break;
        }
      }
    }
  } catch (instErr: any) {
    if (instErr instanceof GitHubRateLimitError) {
      isPartial = true;
    }
  }

  // Step 4: Deduplicate by repository ID
  const seen = new Set<number>();
  const uniqueRepos = allRepos
    .filter((repo) => {
      if (seen.has(repo.id)) return false;
      seen.add(repo.id);
      return true;
    })
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // Step 5: Evaluate diagnostic status
  const hasPrivateRepos = uniqueRepos.some((r) => r.private);

  if (uniqueRepos.length === 0) {
    if (diagnosticStatus === "ok") {
      if (installations.length === 0) {
        diagnosticStatus = "app_not_installed";
        diagnosticMessage = "A GitHub App não está instalada em nenhuma conta ou organização.";
      } else {
        diagnosticStatus = "no_repositories";
        diagnosticMessage = "Nenhum repositório acessível encontrado na conta conectada.";
      }
    }
  } else {
    if (
      installations.length > 0 &&
      installations.every((i) => i.repositorySelection === "selected") &&
      !hasPrivateRepos
    ) {
      diagnosticStatus = "app_installed_limited_access";
      diagnosticMessage = "A GitHub App está instalada com seleção limitada ('Only select repositories'). Concede acesso aos repositórios privados nas definições do GitHub.";
    } else if (installations.length === 0 && !hasPrivateRepos) {
      diagnosticStatus = "app_not_installed";
      diagnosticMessage = "A GitHub App ainda não foi instalada na conta ou organização para aceder a repositórios privados.";
    } else {
      diagnosticStatus = "ok";
    }
  }

  return {
    repositories: uniqueRepos,
    diagnosticStatus,
    diagnosticMessage,
    isPartial,
    installationsCount: installations.length,
    installations,
    appInstallUrl,
  };
}

/**
 * Lists repositories accessible by the connected GitHub user/org.
 * Uses listRepositoriesDetails and returns array of repositories.
 */
export async function listRepositories(
  organizationId: string,
  options?: {
    page?: number;
    per_page?: number;
    sort?: "updated" | "pushed" | "full_name";
    direction?: "asc" | "desc";
    type?: "all" | "owner" | "public" | "private" | "member";
    visibility?: "all" | "public" | "private";
    affiliation?: string;
  }
): Promise<GitHubRepository[]> {
  const result = await listRepositoriesDetails(organizationId, options);
  return result.repositories;
}

/**
 * Retrieves details for a single repository.
 */
export async function getRepository(
  organizationId: string,
  owner: string,
  repo: string
): Promise<GitHubRepository> {
  return githubFetch<GitHubRepository>(organizationId, `/repos/${owner}/${repo}`);
}

/**
 * Lists Pull Requests for a repository.
 */
export async function listPullRequests(
  organizationId: string,
  owner: string,
  repo: string,
  options?: {
    state?: "open" | "closed" | "all";
    page?: number;
    per_page?: number;
  }
): Promise<GitHubPullRequest[]> {
  const state = options?.state || "all";
  const page = options?.page || 1;
  const perPage = options?.per_page || 30;

  const params = new URLSearchParams({
    state,
    page: String(page),
    per_page: String(perPage),
    sort: "updated",
    direction: "desc",
  });

  return githubFetch<GitHubPullRequest[]>(
    organizationId,
    `/repos/${owner}/${repo}/pulls?${params.toString()}`
  );
}

/**
 * Lists Issues for a repository (excluding PRs).
 */
export async function listIssues(
  organizationId: string,
  owner: string,
  repo: string,
  options?: {
    state?: "open" | "closed" | "all";
    page?: number;
    per_page?: number;
  }
): Promise<GitHubIssue[]> {
  const state = options?.state || "all";
  const page = options?.page || 1;
  const perPage = options?.per_page || 30;

  const params = new URLSearchParams({
    state,
    page: String(page),
    per_page: String(perPage),
    sort: "updated",
    direction: "desc",
  });

  const rawIssues = await githubFetch<any[]>(
    organizationId,
    `/repos/${owner}/${repo}/issues?${params.toString()}`
  );

  // GitHub returns PRs in /issues endpoint; filter them out to preserve clean issue views
  return rawIssues
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      html_url: issue.html_url,
      body: issue.body,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      closed_at: issue.closed_at,
      is_pull_request: false,
      user: {
        login: issue.user?.login || "ghost",
        avatar_url: issue.user?.avatar_url || "",
        html_url: issue.user?.html_url || "",
      },
      assignees: (issue.assignees || []).map((a: any) => ({
        login: a.login,
        avatar_url: a.avatar_url,
      })),
      labels: (issue.labels || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        color: l.color,
      })),
    }));
}

/**
 * Lists commits for a repository.
 */
export async function listCommits(
  organizationId: string,
  owner: string,
  repo: string,
  options?: {
    page?: number;
    per_page?: number;
    sha?: string;
  }
): Promise<GitHubCommit[]> {
  const page = options?.page || 1;
  const perPage = options?.per_page || 30;

  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  if (options?.sha) {
    params.set("sha", options.sha);
  }

  return githubFetch<GitHubCommit[]>(
    organizationId,
    `/repos/${owner}/${repo}/commits?${params.toString()}`
  );
}

/**
 * Lists releases for a repository.
 */
export async function listReleases(
  organizationId: string,
  owner: string,
  repo: string,
  options?: {
    page?: number;
    per_page?: number;
  }
): Promise<GitHubRelease[]> {
  const page = options?.page || 1;
  const perPage = options?.per_page || 20;

  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  return githubFetch<GitHubRelease[]>(
    organizationId,
    `/repos/${owner}/${repo}/releases?${params.toString()}`
  );
}

/**
 * Lists contributors for a repository.
 */
export async function listContributors(
  organizationId: string,
  owner: string,
  repo: string,
  options?: {
    page?: number;
    per_page?: number;
  }
): Promise<GitHubContributor[]> {
  const page = options?.page || 1;
  const perPage = options?.per_page || 30;

  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  return githubFetch<GitHubContributor[]>(
    organizationId,
    `/repos/${owner}/${repo}/contributors?${params.toString()}`
  );
}

/**
 * Generates the live recent activity feed from accessible GitHub repositories.
 */
export async function getRecentActivity(organizationId: string): Promise<GitHubActivityEvent[]> {
  try {
    const repos = await listRepositories(organizationId, { per_page: 5, sort: "pushed" });
    const events: GitHubActivityEvent[] = [];

    // Parallel fetch recent PRs, issues and commits across top 3 recently pushed repos
    await Promise.all(
      repos.slice(0, 3).map(async (repo) => {
        const [owner, name] = repo.full_name.split("/");
        try {
          const [prs, issues, commits] = await Promise.all([
            listPullRequests(organizationId, owner, name, { per_page: 3 }),
            listIssues(organizationId, owner, name, { per_page: 3 }),
            listCommits(organizationId, owner, name, { per_page: 3 }),
          ]);

          prs.forEach((pr) => {
            events.push({
              id: `pr-${pr.id}`,
              type: pr.merged ? "pr_merged" : "pr_opened",
              actor: { login: pr.user.login, avatar_url: pr.user.avatar_url },
              repoName: repo.full_name,
              title: pr.title,
              url: pr.html_url,
              number: pr.number,
              timestamp: pr.updated_at || pr.created_at,
            });
          });

          issues.forEach((iss) => {
            events.push({
              id: `issue-${iss.id}`,
              type: iss.state === "closed" ? "issue_closed" : "issue_opened",
              actor: { login: iss.user.login, avatar_url: iss.user.avatar_url },
              repoName: repo.full_name,
              title: iss.title,
              url: iss.html_url,
              number: iss.number,
              timestamp: iss.updated_at || iss.created_at,
            });
          });

          commits.forEach((com) => {
            events.push({
              id: `commit-${com.sha.slice(0, 7)}`,
              type: "commit_pushed",
              actor: {
                login: com.author?.login || com.commit.author.name || "contributor",
                avatar_url: com.author?.avatar_url || "",
              },
              repoName: repo.full_name,
              title: com.commit.message.split("\n")[0],
              url: com.html_url,
              timestamp: com.commit.author.date,
            });
          });
        } catch {}
      })
    );

    // Sort descending by timestamp
    return events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);
  } catch (err) {
    logger.warn("Failed to generate recent GitHub activity", { err });
    return [];
  }
}

/**
 * Lists contents (files and directories) in a repository path.
 */
export async function listRepositoryContents(
  organizationId: string,
  owner: string,
  repo: string,
  path = ""
): Promise<GitHubContentItem[]> {
  const cleanPath = path ? `/${path.replace(/^\/+/, "")}` : "";
  const endpoint = `/repos/${owner}/${repo}/contents${cleanPath}`;
  const data = await githubFetch<GitHubContentItem[] | GitHubContentItem>(organizationId, endpoint);
  const items = Array.isArray(data) ? data : [data];
  // Sort directories first, then alphabetically
  return items.sort((a, b) => {
    if (a.type === "dir" && b.type !== "dir") return -1;
    if (a.type !== "dir" && b.type === "dir") return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Retrieves the decoded README of a repository.
 */
export async function getRepositoryReadme(
  organizationId: string,
  owner: string,
  repo: string
): Promise<GitHubReadme | null> {
  try {
    const data = await githubFetch<{
      name: string;
      content: string;
      encoding: string;
      html_url: string;
    }>(organizationId, `/repos/${owner}/${repo}/readme`);

    if (data && data.content) {
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      return {
        name: data.name,
        content: decoded,
        html_url: data.html_url,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Retrieves file contents decoded on-demand directly from the GitHub repository API.
 * Never stores file code in the database.
 */
export async function getRepositoryFileContent(
  organizationId: string,
  owner: string,
  repo: string,
  path: string
): Promise<GitHubFileContent | null> {
  const cleanPath = path ? `/${path.replace(/^\/+/, "")}` : "";
  try {
    const data = await githubFetch<{
      name: string;
      path: string;
      sha: string;
      size: number;
      type: string;
      content?: string;
      encoding?: string;
      html_url: string;
      download_url?: string | null;
    }>(organizationId, `/repos/${owner}/${repo}/contents${cleanPath}`);

    if (!data || data.type !== "file") {
      return null;
    }

    const binaryExts = [
      "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "tiff",
      "pdf", "zip", "tar", "gz", "7z", "rar", "exe", "dll", "so", "dylib",
      "bin", "iso", "mp3", "mp4", "mov", "avi", "woff", "woff2", "ttf", "eot"
    ];
    const ext = data.name.split(".").pop()?.toLowerCase() || "";
    const isBinaryByExt = binaryExts.includes(ext);

    let decodedContent = "";
    let isBinary = isBinaryByExt;

    if (data.content && data.encoding === "base64" && !isBinaryByExt) {
      try {
        const buf = Buffer.from(data.content, "base64");
        if (buf.includes(0x00)) {
          isBinary = true;
        } else {
          decodedContent = buf.toString("utf-8");
        }
      } catch {
        isBinary = true;
      }
    } else if (data.content && data.encoding !== "base64") {
      decodedContent = data.content;
    }

    return {
      name: data.name,
      path: data.path,
      sha: data.sha,
      size: data.size,
      content: decodedContent,
      html_url: data.html_url,
      download_url: data.download_url,
      isBinary,
    };
  } catch (err) {
    logger.warn("Failed to fetch repository file content", { owner, repo, path, err });
    return null;
  }
}

/**
 * Generates recent activity feed exclusively for a specific repository.
 */
export async function getRepositoryRecentActivity(
  organizationId: string,
  owner: string,
  repo: string
): Promise<GitHubActivityEvent[]> {
  const fullName = `${owner}/${repo}`;
  const events: GitHubActivityEvent[] = [];
  try {
    const [prs, issues, commits] = await Promise.all([
      listPullRequests(organizationId, owner, repo, { per_page: 5 }).catch(() => []),
      listIssues(organizationId, owner, repo, { per_page: 5 }).catch(() => []),
      listCommits(organizationId, owner, repo, { per_page: 10 }).catch(() => []),
    ]);

    prs.forEach((pr) => {
      events.push({
        id: `pr-${pr.id}`,
        type: pr.merged ? "pr_merged" : "pr_opened",
        actor: { login: pr.user.login, avatar_url: pr.user.avatar_url },
        repoName: fullName,
        title: pr.title,
        url: pr.html_url,
        number: pr.number,
        timestamp: pr.updated_at || pr.created_at,
      });
    });

    issues.forEach((iss) => {
      events.push({
        id: `issue-${iss.id}`,
        type: iss.state === "closed" ? "issue_closed" : "issue_opened",
        actor: { login: iss.user.login, avatar_url: iss.user.avatar_url },
        repoName: fullName,
        title: iss.title,
        url: iss.html_url,
        number: iss.number,
        timestamp: iss.updated_at || iss.created_at,
      });
    });

    commits.forEach((com) => {
      events.push({
        id: `commit-${com.sha.slice(0, 7)}`,
        type: "commit_pushed",
        actor: {
          login: com.author?.login || com.commit.author.name || "contributor",
          avatar_url: com.author?.avatar_url || "",
        },
        repoName: fullName,
        title: com.commit.message.split("\n")[0],
        url: com.html_url,
        timestamp: com.commit.author.date,
      });
    });

    return events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (err) {
    logger.warn("Failed to fetch repository specific activity", { owner, repo, err });
    return [];
  }
}

