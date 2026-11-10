// ==============================================================================
// KogSync: Multi-Tenant Shopify Admin API Client (SSRF-Protected, Rate-Limit Safe)
// Features: Active leaky-bucket pacing, exponential backoff with full jitter,
// global serverless deadline protection, and GraphQL cost inspection.
// ==============================================================================

import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto/encryption";
import { sanitizeShopDomain, SHOPIFY_DEFAULT_API_VERSION, SHOPIFY_DOMAIN_REGEX } from "./config";
import {
  ShopifyShop,
  ShopifyProduct,
  ShopifyOrder,
  ShopifyLocation,
  ShopifyInventoryLevel,
  ShopifyIntegrationMetadata,
} from "./types";
import { logger } from "@/lib/security/logger";
import {
  executeWithRateLimitRetry,
  parseRetryAfterHeader,
  ProviderRateLimitError,
  RateLimitMetadata,
} from "../rate-limiting";

/**
 * Validates target endpoint host to prevent Server-Side Request Forgery (SSRF).
 * Strictly requires HTTPS and official *.myshopify.com hostname.
 */
export function isAllowedShopifyHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return false;

    // Check credentials, userinfo, port
    if (parsed.username || parsed.password || parsed.port) return false;

    return SHOPIFY_DOMAIN_REGEX.test(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Parses Shopify leak bucket header: `X-Shopify-Shop-Api-Call-Limit`
 * Format: "38/40" -> { current: 38, max: 40 }
 */
export function parseShopifyCallLimit(header: string | null | undefined): { current: number; max: number } | null {
  if (!header) return null;
  const parts = header.trim().split("/");
  if (parts.length === 2) {
    const current = parseInt(parts[0], 10);
    const max = parseInt(parts[1], 10);
    if (!Number.isNaN(current) && !Number.isNaN(max)) {
      return { current, max };
    }
  }
  return null;
}

/**
 * In-memory process-local store of Shopify leaky bucket states per shop.
 */
export interface ShopifyBucketState {
  current: number;
  max: number;
  lastUpdated: number;
}

const shopifyBuckets = new Map<string, ShopifyBucketState>();

export function getShopifyBucketState(shopDomain: string): ShopifyBucketState | null {
  return shopifyBuckets.get(shopDomain) || null;
}

export function recordShopifyBucketState(
  shopDomain: string,
  current: number,
  max: number,
  lastUpdated = Date.now()
): void {
  shopifyBuckets.set(shopDomain, { current, max, lastUpdated });
}

export function resetShopifyBucketState(shopDomain?: string): void {
  if (shopDomain) {
    shopifyBuckets.delete(shopDomain);
  } else {
    shopifyBuckets.clear();
  }
}

/**
 * Calculates whether a request to the shop requires proactive pacing delay
 * to avoid tripping Shopify's REST leaky bucket limit.
 */
export function calculateShopifyBucketPacingDelay(shopDomain: string, nowMs = Date.now()): number {
  const bucket = shopifyBuckets.get(shopDomain);
  if (!bucket) return 0;

  const elapsedMs = Math.max(0, nowMs - bucket.lastUpdated);
  // Standard store: 2 calls/sec (leak rate 0.002 calls/ms); Plus store: 40 calls/sec
  const leakRatePerMs = bucket.max >= 80 ? 40 / 1000 : 2 / 1000;
  const leaked = Math.floor(elapsedMs * leakRatePerMs);
  const estimatedCurrent = Math.max(0, bucket.current - leaked);

  // If estimated bucket is nearly full (within 1 slot of max), pace request
  if (estimatedCurrent >= bucket.max - 1) {
    const slotsNeeded = estimatedCurrent - (bucket.max - 2);
    // Pacing delay in ms, capped at 1000ms
    return Math.min(1000, Math.max(250, Math.ceil(slotsNeeded / leakRatePerMs)));
  }

  return 0;
}

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds?: number,
    public readonly callLimit?: { current: number; max: number } | null
  ) {
    super(message);
    this.name = "ShopifyApiError";
  }
}

export interface ShopifyGraphQLThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

export interface ShopifyGraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    extensions?: {
      code?: string;
      [key: string]: unknown;
    };
  }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: ShopifyGraphQLThrottleStatus;
    };
  };
}

export class ShopifyClient {
  private constructor(
    private readonly organizationId: string,
    private readonly shopDomain: string,
    private readonly accessToken: string,
    private readonly apiVersion: string = SHOPIFY_DEFAULT_API_VERSION
  ) {}

  public getShopDomain(): string {
    return this.shopDomain;
  }

  public getOrganizationId(): string {
    return this.organizationId;
  }

  /**
   * Factory method: constructs an authenticated ShopifyClient for a given KogSync organization.
   * Enforces tenant isolation, database RLS, and secure server-only token decryption.
   */
  public static async forOrganization(organizationId: string): Promise<ShopifyClient> {
    const supabase = await createClient();

    const { data: record, error } = await supabase
      .from("organization_integrations")
      .select("id, status, encrypted_access_token, metadata")
      .eq("organization_id", organizationId)
      .eq("provider", "shopify")
      .single();

    if (error || !record || record.status !== "connected") {
      throw new ShopifyApiError("Shopify integration is not connected for this organization.", 404);
    }

    if (!record.encrypted_access_token) {
      throw new ShopifyApiError("Missing Shopify credentials for this organization.", 401);
    }

    const metadata = (record.metadata || {}) as ShopifyIntegrationMetadata;
    const rawShopDomain = metadata.shop_domain;
    const cleanShop = sanitizeShopDomain(rawShopDomain);

    if (!cleanShop) {
      throw new ShopifyApiError("Invalid or corrupted Shopify store domain in workspace integration record.", 400);
    }

    const accessToken = decryptToken(record.encrypted_access_token);
    const apiVersion = process.env.SHOPIFY_API_VERSION || SHOPIFY_DEFAULT_API_VERSION;

    return new ShopifyClient(organizationId, cleanShop, accessToken, apiVersion);
  }

  /**
   * Helper factory for deterministic test runners and webhooks with pre-decrypted tokens.
   */
  public static fromDirectCredentials(
    organizationId: string,
    shopDomain: string,
    accessToken: string,
    apiVersion: string = SHOPIFY_DEFAULT_API_VERSION
  ): ShopifyClient {
    const cleanShop = sanitizeShopDomain(shopDomain);
    if (!cleanShop) {
      throw new ShopifyApiError("Invalid store domain", 400);
    }
    return new ShopifyClient(organizationId, cleanShop, accessToken, apiVersion);
  }

  /**
   * Parses Shopify pagination Link header to extract page_info token.
   * Header format: <https://{shop}/admin/api/{version}/products.json?limit=50&page_info=xxx>; rel="next"
   */
  public static parsePaginationLink(linkHeader: string | null | undefined): { next?: string; previous?: string } {
    if (!linkHeader) return {};

    const result: { next?: string; previous?: string } = {};
    const parts = linkHeader.split(",");

    for (const part of parts) {
      const match = part.match(/<[^>]+[?&]page_info=([^>&]+)[^>]*>;\s*rel="([^"]+)"/i);
      if (match) {
        const pageInfo = decodeURIComponent(match[1]);
        const rel = match[2].toLowerCase();
        if (rel === "next") result.next = pageInfo;
        if (rel === "previous") result.previous = pageInfo;
      }
    }

    return result;
  }

  /**
   * SSRF-safe authenticated HTTP fetch with exponential backoff, full jitter,
   * active leaky-bucket pacing, and global serverless deadline protection.
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ data: T; nextCursor?: string; prevCursor?: string }> {
    const fullUrl = path.startsWith("http")
      ? path
      : `https://${this.shopDomain}/admin/api/${this.apiVersion}${path.startsWith("/") ? path : `/${path}`}`;

    if (!isAllowedShopifyHost(fullUrl)) {
      throw new ShopifyApiError("Forbidden: Target URL is not an authorized Shopify endpoint.", 403);
    }

    const method = (options.method || "GET").toUpperCase();
    const isIdempotent = method === "GET" || method === "HEAD";

    try {
      const { data, response } = await executeWithRateLimitRetry<T>({
        provider: "shopify",
        organizationId: this.organizationId,
        operationName: path.split("?")[0],
        isIdempotent,
        execute: async (signal) => {
          // Proactive leaky bucket pacing: if bucket was nearly full on last call, pace to avoid 429
          const pacingMs = calculateShopifyBucketPacingDelay(this.shopDomain);
          if (pacingMs > 0) {
            logger.info("Applying proactive pacing for Shopify leaky bucket", {
              shop: this.shopDomain,
              pacingMs,
            });
            await new Promise((resolve) => setTimeout(resolve, pacingMs));
          }

          const response = await fetch(fullUrl, {
            ...options,
            signal,
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": this.accessToken,
              "User-Agent": "KogSync-Enterprise/1.0",
              ...(options.headers || {}),
            },
          });

          // Handle 401 Unauthorized (response.status === 401)
          if (response.status === 401) {
            throw new ShopifyApiError("Shopify authorization token expired or revoked.", 401);
          }

          return response;
        },
        parseRateLimit: (response: Response): RateLimitMetadata => {
          // Handle 429 Rate Limiting (response.status === 429)
          const retryAfterSeconds = parseRetryAfterHeader(response.headers.get("Retry-After"), 2);
          const callLimit = parseShopifyCallLimit(response.headers.get("X-Shopify-Shop-Api-Call-Limit"));

          if (callLimit) {
            recordShopifyBucketState(this.shopDomain, callLimit.max, callLimit.max);
          }

          return {
            provider: "shopify",
            retryAfterSeconds,
            remaining: callLimit ? callLimit.max - callLimit.current : undefined,
            limit: callLimit?.max,
          };
        },
        onSuccess: async (res) => {
          // Track and monitor call limit usage for proactive pacing & observability
          const callLimit = parseShopifyCallLimit(res.headers.get("X-Shopify-Shop-Api-Call-Limit"));
          if (callLimit) {
            recordShopifyBucketState(this.shopDomain, callLimit.current, callLimit.max);

            if (callLimit.current >= callLimit.max - 2) {
              logger.warn("Shopify API call limit near exhaustion", {
                shop: this.shopDomain,
                organizationId: this.organizationId,
                callLimit,
              });
            }
          }
          return (await res.json()) as T;
        },
      });

      const linkHeader = response.headers.get("Link");
      const { next, previous } = ShopifyClient.parsePaginationLink(linkHeader);

      return { data, nextCursor: next, prevCursor: previous };
    } catch (err: unknown) {
      if (err instanceof ProviderRateLimitError) {
        throw new ShopifyApiError(
          `Shopify API rate limit exceeded. Retry after ${err.retryAfterSeconds}s.`,
          429,
          err.retryAfterSeconds
        );
      }
      if (err instanceof ShopifyApiError) {
        throw err;
      }

      const msg = (err as Error)?.message || String(err);
      if (msg.includes("401")) {
        throw new ShopifyApiError("Shopify authorization token expired or revoked.", 401);
      }
      if (msg.includes("404")) {
        throw new ShopifyApiError("Shopify resource not found.", 404);
      }
      if (msg.includes("403")) {
        throw new ShopifyApiError("Shopify access forbidden or insufficient permissions.", 403);
      }

      throw new ShopifyApiError(msg, 500);
    }
  }

  /**
   * Executes a GraphQL Admin API query with cost analysis and throttling recovery.
   */
  public async graphql<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<ShopifyGraphQLResponse<T>> {
    const fullUrl = `https://${this.shopDomain}/admin/api/${this.apiVersion}/graphql.json`;

    if (!isAllowedShopifyHost(fullUrl)) {
      throw new ShopifyApiError("Forbidden: Target URL is not an authorized Shopify endpoint.", 403);
    }

    const isMutation = query.trim().startsWith("mutation");

    try {
      const { data } = await executeWithRateLimitRetry<ShopifyGraphQLResponse<T>>({
        provider: "shopify",
        organizationId: this.organizationId,
        operationName: "graphql",
        isIdempotent: !isMutation,
        execute: async (signal) => {
          return await fetch(fullUrl, {
            method: "POST",
            signal,
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": this.accessToken,
              "User-Agent": "KogSync-Enterprise/1.0",
            },
            body: JSON.stringify({ query, variables }),
          });
        },
        parseRateLimit: (res: Response): RateLimitMetadata => {
          const retryAfterSeconds = parseRetryAfterHeader(res.headers.get("Retry-After"), 2);
          return {
            provider: "shopify",
            retryAfterSeconds,
            isGraphQL: true,
          };
        },
        onSuccess: async (res) => {
          const json = (await res.json()) as ShopifyGraphQLResponse<T>;

          // Check for GraphQL-level throttling in errors
          const isThrottled = json.errors?.some(
            (e) => e.extensions?.code === "THROTTLED" || e.message.toLowerCase().includes("throttled")
          );

          if (isThrottled) {
            const throttleStatus = json.extensions?.cost?.throttleStatus;
            const restoreRate = throttleStatus?.restoreRate || 50;
            const requestedCost = json.extensions?.cost?.requestedQueryCost || 100;
            const available = throttleStatus?.currentlyAvailable || 0;
            const retryAfter = Math.max(Math.ceil((requestedCost - available) / restoreRate), 2);

            throw new ProviderRateLimitError({
              provider: "shopify",
              retryAfterSeconds: retryAfter,
              isGraphQL: true,
              throttleStatus,
            });
          }

          return json;
        },
      });

      return data;
    } catch (err: unknown) {
      if (err instanceof ProviderRateLimitError) {
        throw new ShopifyApiError(
          `Shopify GraphQL rate limit exceeded. Retry after ${err.retryAfterSeconds}s.`,
          429,
          err.retryAfterSeconds
        );
      }
      throw err;
    }
  }

  /**
   * Retrieves verified store configuration, currency, timezone and plan metadata.
   */
  public async getShop(): Promise<ShopifyShop> {
    const res = await this.request<{ shop: ShopifyShop }>("/shop.json");
    return res.data.shop;
  }

  /**
   * Queries products with pagination and variants.
   */
  public async getProducts(params?: {
    limit?: number;
    status?: "active" | "archived" | "draft";
    updatedAtMin?: string;
    pageInfo?: string;
  }): Promise<{ products: ShopifyProduct[]; nextCursor?: string }> {
    const limit = Math.min(Math.max(params?.limit || 25, 1), 50);
    const searchParams = new URLSearchParams({ limit: limit.toString() });

    if (params?.pageInfo) {
      // Shopify invariant: When following cursor page_info, ONLY limit and page_info are allowed
      searchParams.set("page_info", params.pageInfo);
    } else {
      if (params?.status) {
        searchParams.set("status", params.status);
      }
      if (params?.updatedAtMin) {
        searchParams.set("updated_at_min", params.updatedAtMin);
      }
    }

    const res = await this.request<{ products: ShopifyProduct[] }>(`/products.json?${searchParams.toString()}`);
    return {
      products: res.data.products || [],
      nextCursor: res.nextCursor,
    };
  }

  /**
   * Retrieves a single product with full variants and images.
   */
  public async getProduct(productId: number | string): Promise<ShopifyProduct> {
    const cleanId = encodeURIComponent(String(productId).trim());
    const res = await this.request<{ product: ShopifyProduct }>(`/products/${cleanId}.json`);
    return res.data.product;
  }

  /**
   * Queries recent orders with totals, financial, and fulfillment status.
   */
  public async getOrders(params?: {
    limit?: number;
    status?: "open" | "closed" | "cancelled" | "any";
    updatedAtMin?: string;
    pageInfo?: string;
  }): Promise<{ orders: ShopifyOrder[]; nextCursor?: string }> {
    const limit = Math.min(Math.max(params?.limit || 20, 1), 50);
    const searchParams = new URLSearchParams({ limit: limit.toString() });

    if (params?.pageInfo) {
      // Shopify invariant: When following cursor page_info, ONLY limit and page_info are allowed
      searchParams.set("page_info", params.pageInfo);
    } else {
      searchParams.set("status", params?.status || "any");
      if (params?.updatedAtMin) {
        searchParams.set("updated_at_min", params.updatedAtMin);
      }
    }

    const res = await this.request<{ orders: ShopifyOrder[] }>(`/orders.json?${searchParams.toString()}`);
    return {
      orders: res.data.orders || [],
      nextCursor: res.nextCursor,
    };
  }

  /**
   * Retrieves active physical/digital inventory locations.
   */
  public async getLocations(): Promise<ShopifyLocation[]> {
    const res = await this.request<{ locations: ShopifyLocation[] }>("/locations.json");
    return res.data.locations || [];
  }

  /**
   * Queries inventory availability across store locations.
   */
  public async getInventoryLevels(params?: {
    locationIds?: number[];
    inventoryItemIds?: number[];
  }): Promise<ShopifyInventoryLevel[]> {
    const searchParams = new URLSearchParams();
    if (params?.locationIds && params.locationIds.length > 0) {
      searchParams.set("location_ids", params.locationIds.join(","));
    }
    if (params?.inventoryItemIds && params.inventoryItemIds.length > 0) {
      searchParams.set("inventory_item_ids", params.inventoryItemIds.join(","));
    }

    const qs = searchParams.toString();
    const endpoint = qs ? `/inventory_levels.json?${qs}` : "/inventory_levels.json";
    const res = await this.request<{ inventory_levels: ShopifyInventoryLevel[] }>(endpoint);
    return res.data.inventory_levels || [];
  }
}
