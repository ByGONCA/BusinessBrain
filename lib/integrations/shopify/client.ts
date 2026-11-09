// ==============================================================================
// KogSync: Multi-Tenant Shopify Admin API Client (SSRF-Protected, Rate-Limit Safe)
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

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "ShopifyApiError";
  }
}

export class ShopifyClient {
  private constructor(
    private readonly organizationId: string,
    private readonly shopDomain: string,
    private readonly accessToken: string,
    private readonly apiVersion: string = SHOPIFY_DEFAULT_API_VERSION
  ) {}

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
   * SSRF-safe authenticated HTTP fetch with timeout and rate-limit handling.
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12-second timeout

    try {
      const response = await fetch(fullUrl, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": this.accessToken,
          "User-Agent": "KogSync-Enterprise/1.0",
          ...(options.headers || {}),
        },
      });

      // Handle 429 Rate Limiting
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 2;
        throw new ShopifyApiError(
          `Shopify API rate limit exceeded. Retry after ${retryAfter}s.`,
          429,
          retryAfter
        );
      }

      // Handle 401 Unauthorized (token revoked or uninstalled)
      if (response.status === 401) {
        throw new ShopifyApiError("Shopify authorization token expired or revoked.", 401);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new ShopifyApiError(`Shopify API request failed (${response.status}): ${errorText}`, response.status);
      }

      const linkHeader = response.headers.get("Link");
      const { next, previous } = ShopifyClient.parsePaginationLink(linkHeader);

      const data = (await response.json()) as T;
      return { data, nextCursor: next, prevCursor: previous };
    } finally {
      clearTimeout(timeout);
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
    pageInfo?: string;
  }): Promise<{ products: ShopifyProduct[]; nextCursor?: string }> {
    const limit = Math.min(Math.max(params?.limit || 25, 1), 50);
    const searchParams = new URLSearchParams({ limit: limit.toString() });

    if (params?.status) {
      searchParams.set("status", params.status);
    }
    if (params?.pageInfo) {
      searchParams.set("page_info", params.pageInfo);
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
    pageInfo?: string;
  }): Promise<{ orders: ShopifyOrder[]; nextCursor?: string }> {
    const limit = Math.min(Math.max(params?.limit || 20, 1), 50);
    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      status: params?.status || "any",
    });

    if (params?.pageInfo) {
      searchParams.set("page_info", params.pageInfo);
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
