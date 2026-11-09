// ==============================================================================
// KogSync: Tenant-Isolated In-Memory Cache with Request Coalescing
// Eliminates redundant external API requests, protects against thundering herds,
// and enforces strict multi-tenant key isolation without permanent DB storage.
// ==============================================================================

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
  defaultTtlMs?: number;
  maxEntries?: number;
}

export class TenantMemoryCache<TDefault = unknown> {
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
    this.defaultTtlMs = options.ttlMs ?? options.defaultTtlMs ?? 60 * 1000; // 60 seconds default L1 TTL
    this.maxEntries = options.maxEntries ?? 500; // Cap to 500 tenant entries to guard heap
  }

  public get size(): number {
    return this.cache.size;
  }

  /**
   * Generates a strictly isolated tenant-scoped cache key.
   * Format: `tenant:${orgId}:${provider}:${domain}:${identifier}`
   */
  public buildKey(organizationId: string, provider: string, domain: string, identifier: string): string {
    if (!organizationId || organizationId.trim() === "") {
      throw new Error("Multi-tenant security violation: organizationId is strictly required for cache key.");
    }
    return `tenant:${organizationId.trim()}:${provider.trim()}:${domain.trim()}:${identifier.trim()}`;
  }

  /**
   * Retrieves a cached item if present, unexpired, and strictly owned by the requested tenant.
   */
  public get<T = TDefault>(organizationId: string, provider: string, domain: string, identifier: string): T | null {
    const key = this.buildKey(organizationId, provider, domain, identifier);
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
   * Stores a value in the tenant-isolated cache with capacity management.
   */
  public set<T = TDefault>(
    organizationId: string,
    provider: string,
    domain: string,
    identifier: string,
    value: T,
    ttlMs?: number
  ): void {
    const key = this.buildKey(organizationId, provider, domain, identifier);
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
   * Coalesces concurrent in-flight requests to eliminate stampedes / thundering herds.
   * If a fetch for this key is already running, concurrent callers await the same promise.
   */
  public async coalesce<T = TDefault>(
    organizationId: string,
    provider: string,
    domain: string,
    identifier: string,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const key = this.buildKey(organizationId, provider, domain, identifier);

    // 1. Check existing fresh cache
    const cached = this.get<T>(organizationId, provider, domain, identifier);
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
          this.set(organizationId, provider, domain, identifier, result, ttlMs);
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
   * Invalidates all cache entries for a specific organization and provider.
   */
  public invalidateTenant(organizationId: string, provider: string): number {
    const prefix = `tenant:${organizationId.trim()}:${provider.trim()}:`;
    let count = 0;

    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.stats.activeEntries = this.cache.size;
    return count;
  }

  /**
   * Clears the entire cache (useful for test resets).
   */
  public clear(): void {
    this.cache.clear();
    this.inFlightRequests.clear();
    this.stats.activeEntries = 0;
  }

  public getStats(): CacheStats {
    return { ...this.stats };
  }
}

// Global singletons for API-First integrations
export const shopifyCache = new TenantMemoryCache({ ttlMs: 60 * 1000, maxEntries: 500 });
export const sentryCache = new TenantMemoryCache({ ttlMs: 60 * 1000, maxEntries: 500 });
export const linearCache = new TenantMemoryCache({ ttlMs: 60 * 1000, maxEntries: 500 });
