import { getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { OrganizationRole, OrganizationWithRole } from "@/lib/organizations/types";
import type { User } from "@supabase/supabase-js";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that an identifier matches the standard UUID format.
 */
export function isValidUuid(id: string | null | undefined): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_V4_REGEX.test(id.trim());
}

/**
 * Asserts that an identifier is a valid UUID, throwing an error if invalid.
 */
export function assertValidUuid(id: string | null | undefined, fieldName = "Identifier"): string {
  if (!id || !isValidUuid(id)) {
    throw new Error(`Invalid ${fieldName}: must be a valid UUID.`);
  }
  return id.trim();
}

/**
 * Server-side guard requiring an authenticated Supabase user.
 * Throws an Unauthorized error if unauthenticated.
 */
export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required. Please sign in.");
  }
  return user;
}

/**
 * Server-side guard requiring an active, verified organization membership.
 * Automatically verifies that the user is actually a member of the resolved active organization.
 */
export async function requireActiveOrganization(): Promise<{
  user: User;
  activeOrg: OrganizationWithRole;
}> {
  const user = await requireAuthenticatedUser();
  const activeOrg = await getActiveOrganization();

  if (!activeOrg) {
    throw new Error("No active organization found for user.");
  }

  return { user, activeOrg };
}

/**
 * Server-side guard requiring the user to have one of the permitted roles
 * within the active organization.
 */
export async function requireOrganizationRole(
  allowedRoles: OrganizationRole[]
): Promise<{
  user: User;
  activeOrg: OrganizationWithRole;
}> {
  const { user, activeOrg } = await requireActiveOrganization();

  if (!allowedRoles.includes(activeOrg.role)) {
    throw new Error(
      `Forbidden: Action requires one of the following roles: [${allowedRoles.join(", ")}]. Current role: ${activeOrg.role}.`
    );
  }

  return { user, activeOrg };
}

/**
 * Resolves the internal server authentication secret.
 * In production (NODE_ENV === "production"), strictly requires SERVER_AUTH_SECRET
 * to be defined with at least 32 characters (256 bits of entropy).
 * Throws a fatal configuration error if missing or insufficiently strong in production.
 */
export function getServerAuthSecret(): string {
  const secret = process.env.SERVER_AUTH_SECRET?.trim();
  const isDeployedOrProd =
    process.env.NODE_ENV === "production" ||
    (process.env.NODE_ENV as string) === "staging" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.APP_ENV === "staging" ||
    process.env.APP_ENV === "production";

  if (!secret || secret.length < 32) {
    if (isDeployedOrProd) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION: SERVER_AUTH_SECRET must be defined in production/staging with at least 32 characters (256 bits)."
      );
    }
    // Development and local test suite fallback only (never used in production or staging)
    return "dev-only-insecure-server-auth-key-0123456789abcdef";
  }

  // Prevent accidental use of dummy/placeholder secrets in deployed environments
  if (isDeployedOrProd) {
    const lower = secret.toLowerCase();
    if (lower.includes("dev-only") || lower.includes("insecure") || lower.includes("your-32-byte-hex")) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION: Insecure placeholder or development secret detected in production/staging SERVER_AUTH_SECRET."
      );
    }
  }

  return secret;
}

/**
 * Generates a cryptographic HMAC server token for privileged PostgreSQL RPCs.
 * Prevents unauthorized client callers from executing server-only database functions.
 */
export function getServerAuthToken(purpose: string): string {
  const crypto = require("crypto");
  const secret = getServerAuthSecret();
  return crypto.createHmac("sha256", secret).update(`server-auth:${purpose}`).digest("hex");
}

/**
 * Generates a signed, timestamped cryptographic token for the server-side invitation gateway.
 * Format: `<timestamp>.<signature>`
 * Signature is computed via genuine RFC 2104 HMAC-SHA-256 over: `invitation-details:${tokenHash}:${ts}`
 * Valid for 120 seconds to prevent replay attacks and direct PostgREST enumeration.
 */
export function generateInvitationServerToken(tokenHash: string): string {
  const crypto = require("crypto");
  const secret = getServerAuthSecret();

  const ts = Math.floor(Date.now() / 1000);
  const message = `invitation-details:${tokenHash.toLowerCase().trim()}:${ts}`;
  const sig = crypto.createHmac("sha256", secret).update(message).digest("hex");
  return `${ts}.${sig}`;
}
