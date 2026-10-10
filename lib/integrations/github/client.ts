// ==============================================================================
// Company Brain: GitHub Server-Side API Client
// Secure, scoped, decrypted-token requests with rate-limiting & SSRF protection
// ==============================================================================

import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto/encryption";
import { logger } from "@/lib/security/logger";
import { GITHUB_API_BASE_URL } from "./config";
import {
  GitHubViewer,
  GitHubRepository,
  GitHubPullRequest,
  GitHubIssue,
  GitHubCommit,
  GitHubRelease,
  GitHubContributor,
  GitHubActivityEvent,
} from "./types";

/**
 * Retrieves the decrypted access token for the active organization's GitHub integration.
 */
export async function getDecryptedGitHubToken(organizationId: string): Promise<{
  accessToken: string;
  accountLogin: string;
  accountEmail?: string;
} | null> {
  const supabase = await createClient();

  const { data: integration, error } = await supabase
    .from("organization_integrations")
    .select("id, encrypted_access_token, provider_account_id, account_email, status")
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
      accountLogin: integration.provider_account_id,
      accountEmail: integration.account_email || undefined,
    };
  } catch (err) {
    logger.error("Failed to decrypt GitHub access token", err, { organizationId });
    return null;
  }
}

/**
 * Secure fetch wrapper for GitHub REST API with SSRF protection.
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
    throw new Error("GitHub integration is not connected or token is unavailable.");
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
    next: { revalidate: 60 }, // Cache for 60 seconds
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.warn(`GitHub API request failed (${response.status}) on ${endpoint}`, {
      status: response.status,
      errorBody,
    });
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
 * Lists repositories accessible by the connected GitHub user/org.
 */
export async function listRepositories(
  organizationId: string,
  options?: {
    page?: number;
    per_page?: number;
    sort?: "updated" | "pushed" | "full_name";
    direction?: "asc" | "desc";
    type?: "all" | "owner" | "public" | "private" | "member";
  }
): Promise<GitHubRepository[]> {
  const page = options?.page || 1;
  const perPage = options?.per_page || 30;
  const sort = options?.sort || "updated";
  const direction = options?.direction || "desc";
  const type = options?.type || "all";

  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    sort,
    direction,
    type,
  });

  return githubFetch<GitHubRepository[]>(organizationId, `/user/repos?${params.toString()}`);
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
    logger.error("Failed to generate recent GitHub activity", err, { organizationId });
    return [];
  }
}
