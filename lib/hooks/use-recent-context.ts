"use client";

import * as React from "react";

export type RecentContextItemType = "page" | "project" | "decision" | "task" | "settings";

export interface RecentContextItem {
  id: string;
  title: string;
  type: RecentContextItemType;
  href: string;
  visitedAt: number;
}

const MAX_RECENT_ITEMS = 6;
const VALID_TYPES: readonly RecentContextItemType[] = ["page", "project", "decision", "task", "settings"];

function getStorageKey(organizationId: string, userId?: string): string {
  const safeOrg = organizationId || "default";
  const safeUser = userId || "anonymous";
  return `cb_recent_context_${safeOrg}_${safeUser}`;
}

/**
 * Sanitizes an internal URL path to ensure:
 * 1. Must start with '/dashboard'
 * 2. Hash fragments are strictly stripped (#...)
 * 3. Arbitrary query parameters are stripped; only verified canonical entity ID parameters (?id=<uuid>) are preserved.
 */
export function sanitizeInternalHref(href: unknown): string {
  if (!href || typeof href !== "string") return "";
  const trimmed = href.trim();
  // Strip fragment (#...)
  const noHash = trimmed.split("#")[0];
  // Strip arbitrary query parameters
  const [pathname, search] = noHash.split("?");
  if (!pathname.startsWith("/dashboard")) return "";

  if (search) {
    const params = new URLSearchParams(search);
    const id = params.get("id");
    // Only permit standard UUID entity identifiers, discard all tracking/state params
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      return `${pathname}?id=${id}`;
    }
  }

  return pathname;
}

export function parseStoredRecentItems(raw: string | null): RecentContextItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): RecentContextItem | null => {
        if (!item || typeof item !== "object") return null;
        const id = typeof item.id === "string" ? item.id.trim() : "";
        const title = typeof item.title === "string" ? item.title.trim().slice(0, 100) : "";
        const type = typeof item.type === "string" ? (item.type as RecentContextItemType) : null;
        const visitedAt = typeof item.visitedAt === "number" ? item.visitedAt : 0;
        const sanitizedHref = sanitizeInternalHref(item.href);

        if (!id || !title || !sanitizedHref || !visitedAt || !type) return null;
        if (!VALID_TYPES.includes(type)) return null;

        return {
          id,
          title,
          type,
          href: sanitizedHref,
          visitedAt,
        };
      })
      .filter((item): item is RecentContextItem => item !== null)
      .slice(0, MAX_RECENT_ITEMS);
  } catch {
    return [];
  }
}

export function useRecentContext(organizationId: string, userId?: string) {
  const storageKey = React.useMemo(
    () => getStorageKey(organizationId, userId),
    [organizationId, userId]
  );

  // State is paired with storageKey to prevent stale context flash when switching org/user
  const [activeState, setActiveState] = React.useState<{
    key: string;
    items: RecentContextItem[];
    isLoaded: boolean;
  }>({
    key: storageKey,
    items: [],
    isLoaded: false,
  });

  // Load from localStorage on mount or key change
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      const items = parseStoredRecentItems(raw);
      setActiveState({ key: storageKey, items, isLoaded: true });
    } catch {
      // Graceful fallback for quota / private browsing restrictions
      setActiveState({ key: storageKey, items: [], isLoaded: true });
    }
  }, [storageKey]);

  // Synchronously enforce key match: if storageKey changes, immediately return [] until useEffect resolves
  const isKeyMatched = activeState.key === storageKey;
  const recentItems = isKeyMatched ? activeState.items : [];
  const isLoaded = isKeyMatched ? activeState.isLoaded : false;

  const recordVisit = React.useCallback(
    (item: Omit<RecentContextItem, "visitedAt">) => {
      const sanitizedHref = sanitizeInternalHref(item.href);
      if (typeof window === "undefined" || !item.id || !sanitizedHref) return;

      const title = (item.title || "Untitled").trim().slice(0, 100);

      setActiveState((prev) => {
        const now = Date.now();
        const newItem: RecentContextItem = {
          ...item,
          title,
          href: sanitizedHref,
          visitedAt: now,
        };

        const currentItems = prev.key === storageKey ? prev.items : [];
        // Filter out existing entry with same id or href to move it to the front (deduplicate)
        const filtered = currentItems.filter(
          (existing) => existing.id !== item.id && existing.href !== sanitizedHref
        );
        const updated = [newItem, ...filtered].slice(0, MAX_RECENT_ITEMS);

        try {
          window.localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // Quota exceeded or storage disabled — keep in-memory state without crashing
        }

        return {
          key: storageKey,
          items: updated,
          isLoaded: true,
        };
      });
    },
    [storageKey]
  );

  const clearRecent = React.useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
    setActiveState({ key: storageKey, items: [], isLoaded: true });
  }, [storageKey]);

  return {
    recentItems,
    isLoaded,
    recordVisit,
    clearRecent,
  };
}
