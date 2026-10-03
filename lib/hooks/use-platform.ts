"use client";

import * as React from "react";

export type Platform = "windows" | "mac" | "ios" | "linux" | "android" | "other";

/**
 * Detects the client's operating system using User-Agent Data and legacy navigator fallbacks.
 */
export function detectPlatform(): Platform {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "windows";
  }

  // 1. Modern User-Agent Client Hints API (Chromium, Edge, Opera, etc.)
  const navWithUAD = navigator as unknown as {
    userAgentData?: {
      platform?: string;
    };
  };
  const uadPlatform = navWithUAD.userAgentData?.platform?.toLowerCase?.();
  if (uadPlatform) {
    if (uadPlatform.includes("win")) return "windows";
    if (uadPlatform.includes("mac")) return "mac";
    if (uadPlatform.includes("ios")) return "ios";
    if (uadPlatform.includes("linux")) return "linux";
    if (uadPlatform.includes("android")) return "android";
  }

  // 2. Fallbacks via userAgent & platform string
  const ua = (navigator.userAgent || "").toLowerCase();
  const platform = (navigator.platform || "").toLowerCase();

  // iPadOS 13+ reports MacIntel but has touch points
  const isIPad =
    platform.includes("mac") &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;

  if (/iphone|ipad|ipod/.test(ua) || isIPad) {
    return "ios";
  }

  if (platform.includes("mac") || ua.includes("macintosh") || ua.includes("mac os x")) {
    return "mac";
  }

  if (platform.includes("win") || ua.includes("windows")) {
    return "windows";
  }

  if (ua.includes("android")) {
    return "android";
  }

  if (platform.includes("linux") || ua.includes("linux")) {
    return "linux";
  }

  return "other";
}

/**
 * Returns true if the device belongs to Apple's ecosystem (macOS or iOS/iPadOS).
 */
export function isApplePlatform(platform: Platform): boolean {
  return platform === "mac" || platform === "ios";
}

/**
 * Hook providing dynamic OS detection and keyboard modifier key labels.
 *
 * - On Windows / Linux: `modKey` is `"Ctrl"`, `modKeyName` is `"Ctrl"`
 * - On macOS / iOS: `modKey` is `"⌘"`, `modKeyName` is `"Cmd"`
 */
export function usePlatform() {
  const [platform, setPlatform] = React.useState<Platform>("windows");
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setPlatform(detectPlatform());
    setIsMounted(true);
  }, []);

  const isApple = isMounted ? isApplePlatform(platform) : false;
  const isWindows = isMounted ? platform === "windows" : true;

  const modKey = isApple ? "⌘" : "Ctrl";
  const modKeyName = isApple ? "Cmd" : "Ctrl";

  return {
    platform,
    isApple,
    isWindows,
    isMounted,
    modKey,
    modKeyName,
    /**
     * Formats a shortcut label:
     * - Apple: `⌘K` or `⌘ /`
     * - Windows/Linux: `Ctrl+K` or `Ctrl /`
     */
    formatShortcut: (key: string, withSpace = false): string => {
      if (isApple) {
        return withSpace ? `⌘ ${key}` : `⌘${key}`;
      }
      return withSpace ? `Ctrl ${key}` : `Ctrl+${key}`;
    },
    /**
     * Formats descriptive key combos like `Ctrl + Enter` vs `Cmd + Enter`.
     */
    formatCombo: (key: string): string => {
      return `${modKeyName} + ${key}`;
    },
  };
}
