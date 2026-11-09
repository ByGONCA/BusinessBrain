// ==============================================================================
// KogSync: Multi-Tenant Sentry API Client (SSRF-Protected, Auto-Refresh, Rate-Limit Safe)
// ==============================================================================

import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto/encryption";
import { refreshSentryTokenWithLock } from "./oauth";
import { SENTRY_DEFAULT_API_BASE, SENTRY_EU_API_BASE } from "./config";
import {
  SentryOrganization,
  SentryProject,
  SentryIssue,
  SentryEventDetail,
  SentryIntegrationMetadata,
} from "./types";
import { logger } from "@/lib/security/logger";
import {
  executeWithRateLimitRetry,
  parseRetryAfterHeader,
  ProviderRateLimitError,
  RateLimitMetadata,
} from "../rate-limiting";

const ALLOWED_HOSTS = new Set([
  "sentry.io",
  "us.sentry.io",
  "de.sentry.io",
]);

/**
 * Validates target endpoint host to prevent Server-Side Request Forgery (SSRF).
 */
export function isAllowedSentryHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith(".sentry.io");
  } catch {
    return false;
  }
}

/**
 * Parses Sentry rate limit headers.
 */
export function parseSentryRateLimitHeaders(headers: Headers): {
  retryAfterSeconds: number;
  remaining?: number;
  resetEpochSeconds?: number;
  categories?: string;
} {
  const retryAfterHeader = headers.get("Retry-After");
  const remainingHeader = headers.get("X-Sentry-Rate-Limit-Remaining");
  const resetHeader = headers.get("X-Sentry-Rate-Limit-Reset");
  const categories = headers.get("X-Sentry-Rate-Limit-Categories") || undefined;

  let retryAfterSeconds = parseRetryAfterHeader(retryAfterHeader, 2);

  let resetEpochSeconds: number | undefined;
  if (resetHeader) {
    const parsedReset = parseInt(resetHeader, 10);
    if (!Number.isNaN(parsedReset)) {
      if (parsedReset > 1000000000) {
        // Unix epoch timestamp
        resetEpochSeconds = parsedReset;
        const diff = Math.ceil(parsedReset - Date.now() / 1000);
        if (!retryAfterHeader && diff > 0) {
          retryAfterSeconds = diff;
        }
      } else {
        // Delta seconds
        if (!retryAfterHeader && parsedReset > 0) {
          retryAfterSeconds = parsedReset;
        }
      }
    }
  }

  const remaining = remainingHeader ? parseInt(remainingHeader, 10) : undefined;

  return {
    retryAfterSeconds,
    remaining: Number.isNaN(remaining) ? undefined : remaining,
    resetEpochSeconds,
    categories,
  };
}

export class SentryApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds?: number,
    public readonly category?: string,
    public readonly remaining?: number
  ) {
    super(message);
    this.name = "SentryApiError";
  }
}

export class SentryClient {
  private constructor(
    private readonly organizationId: string,
    private accessToken: string,
    private readonly regionUrl: string = SENTRY_DEFAULT_API_BASE
  ) {}

  public getOrganizationId(): string {
    return this.organizationId;
  }

  /**
   * Factory method: constructs an authenticated SentryClient for a given KogSync organization.
   * Enforces tenant isolation and automatic token refresh.
   */
  public static async forOrganization(organizationId: string): Promise<SentryClient> {
    const supabase = await createClient();

    const { data: record, error } = await supabase
      .from("organization_integrations")
      .select("id, status, encrypted_access_token, encrypted_refresh_token, token_expires_at, metadata")
      .eq("organization_id", organizationId)
      .eq("provider", "sentry")
      .single();

    if (error || !record || record.status !== "connected") {
      throw new SentryApiError("Sentry integration is not connected for this organization.", 404);
    }

    if (!record.encrypted_access_token) {
      throw new SentryApiError("Missing Sentry credentials for this organization.", 401);
    }

    const metadata = (record.metadata || {}) as SentryIntegrationMetadata;
    const regionUrl = metadata.region_url || SENTRY_DEFAULT_API_BASE;

    const expiresAt = record.token_expires_at ? new Date(record.token_expires_at).getTime() : 0;
    const isNearExpiry = expiresAt > 0 && expiresAt < Date.now() + 2 * 60 * 1000;

    let accessToken: string;

    if (isNearExpiry && record.encrypted_refresh_token) {
      try {
        const refreshTokenPlaintext = decryptToken(record.encrypted_refresh_token);
        const refreshed = await refreshSentryTokenWithLock(organizationId, refreshTokenPlaintext);
        accessToken = refreshed.access_token;
      } catch (err: unknown) {
        logger.warn("Proactive Sentry token refresh failed, falling back to current access token", {
          organizationId,
          error: String(err),
        });
        accessToken = decryptToken(record.encrypted_access_token);
      }
    } else {
      accessToken = decryptToken(record.encrypted_access_token);
    }

    return new SentryClient(organizationId, accessToken, regionUrl);
  }

  /**
   * Parses Sentry Link header to extract next cursor if results="true".
   */
  public static parseNextCursor(linkHeader: string | null | undefined): string | null {
    if (!linkHeader) return null;
    const matches = linkHeader.match(/<[^>]+[?&]cursor=([^>&]+)[^>]*>;\s*rel="next";\s*results="true"/i);
    return matches?.[1] ? decodeURIComponent(matches[1]) : null;
  }

  /**
   * SSRF-safe authenticated HTTP fetch with exponential backoff, full jitter,
   * rate-limit header parsing, and serverless budget protection.
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<{ data: T; nextCursor?: string }> {
    const fullUrl = path.startsWith("http") ? path : `${this.regionUrl}${path.startsWith("/") ? path : `/${path}`}`;

    if (!isAllowedSentryHost(fullUrl)) {
      throw new SentryApiError("Forbidden: Target URL is not an authorized Sentry endpoint.", 403);
    }

    const method = (options.method || "GET").toUpperCase();
    const isIdempotent = method === "GET" || method === "HEAD";

    try {
      const { data, response } = await executeWithRateLimitRetry<T>({
        provider: "sentry",
        organizationId: this.organizationId,
        operationName: path.split("?")[0],
        isIdempotent,
        execute: async (signal) => {
          const response = await fetch(fullUrl, {
            ...options,
            signal,
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.accessToken}`,
              "User-Agent": "KogSync-Enterprise/1.0",
              ...(options.headers || {}),
            },
          });

          // Handle HTTP 401 Unauthorized (response.status === 401)
          if (response.status === 401) {
            throw new SentryApiError("Sentry authorization token expired or revoked.", 401);
          }

          return response;
        },
        parseRateLimit: (response: Response): RateLimitMetadata => {
          // Handle HTTP 429 Rate Limiting (response.status === 429)
          const retryAfterHeader = response.headers.get("Retry-After");
          const parsed = parseSentryRateLimitHeaders(response.headers);
          return {
            provider: "sentry",
            retryAfterSeconds: parsed.retryAfterSeconds,
            remaining: parsed.remaining,
            resetEpochSeconds: parsed.resetEpochSeconds,
            category: parsed.categories,
          };
        },
      });

      // Extract pagination cursor from Sentry Link header if present:
      // Link: <url>; rel="next"; results="true"; cursor="100:0:0"
      const linkHeader = response.headers.get("Link");
      const nextCursor = SentryClient.parseNextCursor(linkHeader) || undefined;

      return { data, nextCursor };
    } catch (err: unknown) {
      if (err instanceof ProviderRateLimitError) {
        throw new SentryApiError(
          `Sentry API rate limit exceeded. Retry after ${err.retryAfterSeconds}s.`,
          429,
          err.retryAfterSeconds,
          err.remaining !== undefined ? String(err.remaining) : undefined,
          err.remaining
        );
      }
      if (err instanceof SentryApiError) {
        throw err;
      }

      const msg = (err as Error)?.message || String(err);
      if (msg.includes("401")) {
        throw new SentryApiError("Sentry authorization token expired or revoked.", 401);
      }
      if (msg.includes("404")) {
        throw new SentryApiError("Sentry resource not found.", 404);
      }
      if (msg.includes("403")) {
        throw new SentryApiError("Sentry access forbidden or insufficient permissions.", 403);
      }

      throw new SentryApiError(msg, 500);
    }
  }

  /**
   * Lists organizations the authorized user has access to.
   */
  public async getOrganizations(): Promise<SentryOrganization[]> {
    const res = await this.request<SentryOrganization[]>("/organizations/");
    return res.data;
  }

  /**
   * Lists projects within a specific Sentry organization.
   */
  public async getProjects(orgSlug: string): Promise<SentryProject[]> {
    const cleanOrg = encodeURIComponent(orgSlug.trim());
    const res = await this.request<SentryProject[]>(`/organizations/${cleanOrg}/projects/`);
    return res.data;
  }

  /**
   * Queries unresolved/resolved issues in a project or organization.
   */
  public async getIssues(options: {
    orgSlug: string;
    projectSlug?: string;
    query?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ issues: SentryIssue[]; nextCursor?: string }> {
    const cleanOrg = encodeURIComponent(options.orgSlug.trim());
    const limit = Math.min(Math.max(options.limit || 25, 1), 50);

    const params = new URLSearchParams({
      limit: limit.toString(),
    });

    if (options.query) {
      params.set("query", options.query);
    }
    if (options.cursor) {
      params.set("cursor", options.cursor);
    }

    const endpoint = options.projectSlug
      ? `/projects/${cleanOrg}/${encodeURIComponent(options.projectSlug.trim())}/issues/?${params.toString()}`
      : `/organizations/${cleanOrg}/issues/?${params.toString()}`;

    const res = await this.request<SentryIssue[]>(endpoint);
    return {
      issues: res.data || [],
      nextCursor: res.nextCursor,
    };
  }

  /**
   * Retrieves single issue details with latest events and tags.
   */
  public async getIssue(issueId: string): Promise<SentryIssue> {
    const cleanId = encodeURIComponent(issueId.trim());
    const res = await this.request<SentryIssue>(`/issues/${cleanId}/`);
    return res.data;
  }

  /**
   * Retrieves the latest event occurrence for an issue (including stack trace and tags).
   */
  public async getLatestEvent(issueId: string): Promise<SentryEventDetail | null> {
    try {
      const cleanId = encodeURIComponent(issueId.trim());
      const res = await this.request<SentryEventDetail>(`/issues/${cleanId}/events/latest/`);
      return res.data;
    } catch (err) {
      if (err instanceof SentryApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Retrieves full details for an individual event within an issue.
   */
  public async getEventDetail(issueId: string, eventId: string): Promise<SentryEventDetail> {
    const cleanIssue = encodeURIComponent(issueId.trim());
    const cleanEvent = encodeURIComponent(eventId.trim());
    const res = await this.request<SentryEventDetail>(`/issues/${cleanIssue}/events/${cleanEvent}/`);
    return res.data;
  }
}
