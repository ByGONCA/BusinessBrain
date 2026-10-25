/**
 * Tenant-Isolated In-Memory Multi-Tier Cache Layer for Financial Analytics (DATA-ARCH-01)
 *
 * Implements:
 * 1. Strict Multi-Tenant Key Isolation: All cache entries are strictly scoped to the tenant ID.
 * 2. Single-Flight Request Coalescing (Stampede / Thundering Herd Protection):
 *    Concurrent queries for the same organization coalesce into a single execution Promise.
 * 3. Bounded LRU/Expiration Eviction: Maximum capacity safeguard to prevent memory leaks in server runtimes.
 * 4. Granular Invalidation: Targeted invalidation per organization on manual refresh or webhook events.
 */

import { logger } from "@/lib/security/logger";

export interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp in ms
  createdAt: number;
  organizationId: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  coalescedHits: number;
  activeEntries: number;
}

export interface CacheOptions {
  ttlMs?: number;
  maxEntries?: number;
}

export class TenantMemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private inFlightRequests: Map<string, Promise<unknown>> = new Map();
  private maxEntries: number;
  private defaultTtlMs: number;

  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    coalescedHits: 0,
    activeEntries: 0,
  };

  constructor(options: CacheOptions = {}) {
    this.defaultTtlMs = options.ttlMs ?? 60 * 1000; // 60s default L1 TTL
    this.maxEntries = options.maxEntries ?? 500; // Cap to 500 tenant entries
  }

  /**
   * Generates a strictly isolated tenant-scoped cache key.
   * Format: `tenant:${orgId}:${domain}:${identifier}`
   */
  public buildKey(organizationId: string, domain: string, identifier: string): string {
    if (!organizationId || organizationId.trim() === "") {
      throw new Error("Multi-tenant violation: organizationId is strictly required for cache key generation.");
    }
    return `tenant:${organizationId.trim()}:${domain.trim()}:${identifier.trim()}`;
  }

  /**
   * Retrieves a cached item if present, valid, and matching the requested tenant.
   */
  public get<T>(organizationId: string, domain: string, identifier: string): T | null {
    const key = this.buildKey(organizationId, domain, identifier);
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Verify tenant isolation consistency
    if (entry.organizationId !== organizationId) {
      logger.error("Multi-tenant security breach attempt detected in memory cache", {
        requestedOrg: organizationId,
        cachedOrg: entry.organizationId,
      });
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      this.stats.activeEntries = this.cache.size;
      return null;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Stores a value in the tenant-isolated cache.
   */
  public set<T>(
    organizationId: string,
    domain: string,
    identifier: string,
    value: T,
    ttlMs?: number
  ): void {
    const key = this.buildKey(organizationId, domain, identifier);
    const ttl = ttlMs ?? this.defaultTtlMs;
    const now = Date.now();

    // Capacity safeguard: Prune oldest entry if capacity is exceeded
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: now + ttl,
      createdAt: now,
      organizationId,
    });

    this.stats.activeEntries = this.cache.size;
  }

  /**
   * Coalesces concurrent in-flight requests to eliminate stampede / thundering herd.
   * If a fetch for this key is already running, subsequent callers await the existing promise.
   */
  public async coalesce<T>(
    organizationId: string,
    domain: string,
    identifier: string,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const key = this.buildKey(organizationId, domain, identifier);

    // 1. Check existing fresh cache
    const cached = this.get<T>(organizationId, domain, identifier);
    if (cached !== null) {
      return cached;
    }

    // 2. Check if a request is already in-flight for this tenant key
    const inFlight = this.inFlightRequests.get(key) as Promise<T> | undefined;
    if (inFlight) {
      this.stats.coalescedHits++;
      return inFlight;
    }

    // 3. Initiate single-flight execution
    const executionPromise = (async () => {
      try {
        const result = await fetcher();
        if (result !== null && result !== undefined) {
          this.set(organizationId, domain, identifier, result, ttlMs);
        }
        return result;
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, executionPromise);
    return executionPromise;
  }

  /**
   * Invalidates all cache entries belonging to a specific organization.
   * Useful when an integration is disconnected or when metrics are manually refreshed.
   */
  public invalidateOrganization(organizationId: string, domain?: string): number {
    if (!organizationId) return 0;

    const prefix = domain
      ? `tenant:${organizationId}:${domain}:`
      : `tenant:${organizationId}:`;

    let deletedCount = 0;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    this.stats.activeEntries = this.cache.size;
    return deletedCount;
  }

  /**
   * Explicitly clears the entire in-memory cache (for test teardown or process reset).
   */
  public clear(): void {
    this.cache.clear();
    this.inFlightRequests.clear();
    this.stats.activeEntries = 0;
  }

  /**
   * Retrieves operational telemetry on cache behavior.
   */
  public getStats(): CacheStats {
    return {
      ...this.stats,
      activeEntries: this.cache.size,
    };
  }
}

// Global singleton instance for Stripe Financial Metrics L1 caching
export const stripeFinancialMemoryCache = new TenantMemoryCache({
  ttlMs: 60 * 1000, // 60 seconds L1 TTL
  maxEntries: 1000,
});
