import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { OrganizationWithRole, OrganizationMember, Organization, Profile } from "./types";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";

export const ACTIVE_ORG_COOKIE_NAME = "cb_active_org_id";
export const ORG_HEADER_NAME = "x-organization-id";

interface OrgMemberQueryResult {
  role: OrganizationWithRole["role"];
  organizations: Organization | null;
}

/**
 * Retrieves all organizations the authenticated user belongs to.
 * Memoized per request to eliminate redundant database roundtrips.
 */
export const getUserOrganizations = cache(async (): Promise<OrganizationWithRole[]> => {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select(`
      role,
      organizations (
        id,
        name,
        slug,
        created_by,
        status,
        created_at,
        updated_at
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !data) {
    logger.error("Error fetching user organizations", error, { userId: user.id });
    return [];
  }

  const queryRows = data as unknown as OrgMemberQueryResult[];

  return queryRows
    .filter((row): row is OrgMemberQueryResult & { organizations: Organization } => row.organizations !== null)
    .map((row) => ({
      ...row.organizations,
      role: row.role,
    }));
});

/**
 * Resolves and validates the current active organization for the authenticated user.
 * Memoized per request so multiple components in the same render tree execute instantly.
 */
export const getActiveOrganization = cache(async (): Promise<OrganizationWithRole | null> => {
  const orgs = await getUserOrganizations();
  if (orgs.length === 0) {
    return null;
  }

  const headerList = await headers();
  const orgHeader = headerList.get(ORG_HEADER_NAME);

  const cookieStore = await cookies();
  const orgCookie = cookieStore.get(ACTIVE_ORG_COOKIE_NAME)?.value;

  const candidateId = orgHeader || orgCookie;

  // Validate format and ensure user is a verified member of candidate organization
  if (candidateId && isValidUuid(candidateId)) {
    const matched = orgs.find((org) => org.id === candidateId);
    if (matched) {
      return matched;
    }
  }

  // Fallback to first verified organization
  return orgs[0];
});

/**
 * Retrieves member list for a specific organization with user profiles.
 * Uses a single PostgREST join query to fetch members and profiles in one round-trip.
 * Falls back to a 2-query path if PostgREST cannot resolve the FK join.
 * Memoized per request using React cache().
 */
export const getOrganizationMembers = cache(async (
  organizationId: string
): Promise<OrganizationMember[]> => {
  if (!isValidUuid(organizationId)) {
    return [];
  }

  const supabase = await createClient();

  // Attempt single round-trip join: organization_members + profiles via user_id FK
  const { data: joined, error: joinError } = await supabase
    .from("organization_members")
    .select(`
      id, organization_id, user_id, role, job_title, department, created_at, updated_at,
      profiles!user_id (
        id, email, full_name, avatar_url, job_title, department, bio, location, created_at, updated_at
      )
    `)
    .eq("organization_id", organizationId);

  // If the join succeeds, map and return in one pass
  if (!joinError && joined) {
    return joined.map((row) => {
      const rawProf = row.profiles as unknown;
      const prof = (Array.isArray(rawProf) ? rawProf[0] : rawProf) as Profile | null | undefined;

      return {
        id: row.id,
        organization_id: row.organization_id,
        user_id: row.user_id,
        role: row.role as OrganizationMember["role"],
        job_title: row.job_title || prof?.job_title || "",
        department: row.department || prof?.department || "",
        created_at: row.created_at,
        updated_at: row.updated_at,
        profile: prof ?? undefined,
      };
    });
  }

  // PostgREST could not resolve the FK join (PGRST200 or schema not yet reflected) —
  // fall back to the original sequential 2-query approach transparently.
  const isJoinResolutionError =
    joinError?.code === "PGRST200" ||
    joinError?.code === "42703" ||
    joinError?.message?.includes("Could not find") ||
    joinError?.message?.includes("does not exist");

  if (isJoinResolutionError) {
    logger.warn("getOrganizationMembers: FK join unavailable, falling back to 2-query path", {
      organizationId,
      code: joinError?.code,
    });
    return getOrganizationMembersFallback(organizationId, supabase);
  }

  logger.error("Error fetching organization members", joinError, { organizationId });
  return [];
});

/**
 * Fallback implementation using two sequential queries.
 * Used when the PostgREST join in getOrganizationMembers cannot resolve the FK path.
 */
async function getOrganizationMembersFallback(
  organizationId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<OrganizationMember[]> {
  let members: Array<{
    id: string;
    organization_id: string;
    user_id: string;
    role: OrganizationMember["role"];
    job_title?: string | null;
    department?: string | null;
    created_at: string;
    updated_at: string;
  }> | null = null;

  const { data: fullMembers, error: membersError } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, job_title, department, created_at, updated_at")
    .eq("organization_id", organizationId);

  if (membersError) {
    // If job_title or department does not exist yet (code 42703), fallback gracefully
    if (membersError.code === "42703" || membersError.message?.includes("does not exist")) {
      const { data: basicMembers, error: basicError } = await supabase
        .from("organization_members")
        .select("id, organization_id, user_id, role, created_at, updated_at")
        .eq("organization_id", organizationId);

      if (basicError || !basicMembers) {
        logger.error("Error fetching organization members (fallback)", basicError, { organizationId });
        return [];
      }
      members = basicMembers.map((m) => ({ ...m, job_title: "", department: "" }));
    } else {
      logger.error("Error fetching organization members", membersError, { organizationId });
      return [];
    }
  } else {
    members = fullMembers;
  }

  if (!members) {
    return [];
  }

  const userIds = members.map((m) => m.user_id);
  const { data: profiles, error: profilesError } =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, email, full_name, avatar_url, job_title, department, bio, location, created_at, updated_at")
          .in("id", userIds)
      : { data: [], error: null };

  if (profilesError) {
    logger.error("Error fetching member profiles", profilesError, { organizationId });
  }

  const profilesMap = new Map((profiles || []).map((p) => [p.id, p]));

  return members.map((row) => {
    const prof = profilesMap.get(row.user_id);
    return {
      id: row.id,
      organization_id: row.organization_id,
      user_id: row.user_id,
      role: row.role,
      job_title: row.job_title || prof?.job_title || "",
      department: row.department || prof?.department || "",
      created_at: row.created_at,
      updated_at: row.updated_at,
      profile: prof,
    };
  });
}
