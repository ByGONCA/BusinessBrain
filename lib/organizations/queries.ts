import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { OrganizationWithRole, OrganizationMember, Organization } from "./types";
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
 * Decouples members and profiles lookup to prevent PostgREST cross-schema relationship errors.
 * Memoized per request using React cache().
 */
export const getOrganizationMembers = cache(async (
  organizationId: string
): Promise<OrganizationMember[]> => {
  if (!isValidUuid(organizationId)) {
    return [];
  }

  const supabase = await createClient();

  const { data: members, error: membersError } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, job_title, department, created_at, updated_at")
    .eq("organization_id", organizationId);

  if (membersError || !members) {
    logger.error("Error fetching organization members", membersError, { organizationId });
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
});
