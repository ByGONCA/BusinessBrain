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
 * Generates a cryptographic HMAC server token for privileged PostgreSQL RPCs.
 * Prevents unauthorized client callers from executing server-only database functions.
 */
export function getServerAuthToken(purpose: string): string {
  // Use crypto from node
  const crypto = require("crypto");
  const secret =
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
    process.env.STRIPE_WEBHOOK_SECRET ||
    process.env.STRIPE_SECRET_KEY ||
    "company-brain-internal-server-auth-key";

  return crypto.createHmac("sha256", secret).update(`server-auth:${purpose}`).digest("hex");
}
