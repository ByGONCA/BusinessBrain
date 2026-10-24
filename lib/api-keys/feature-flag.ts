// ==============================================================================
// Company Brain: Enterprise Public API Feature Flag & Controlled Blocker
// Strictly DISABLED BY DEFAULT in all environments.
// Cannot be active by omission in any environment.
// ==============================================================================

import { NextResponse } from "next/server";

/**
 * Feature flag for Enterprise Public API (/api/v1).
 * Strictly false by default. Only enabled when explicitly set to "true".
 */
export function isPublicApiEnabled(): boolean {
  return process.env.FEATURE_FLAG_PUBLIC_API_ENABLED === "true";
}

/**
 * Standardized controlled unavailable response (HTTP 404 Not Found).
 * Returned immediately without executing business logic, authenticating keys,
 * or querying database records.
 */
export function publicApiUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Not Found",
      message: "The Enterprise Public API (/api/v1) is disabled and not available in the current release.",
      code: "PUBLIC_API_DISABLED",
    },
    {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
