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

  // 1. Fetch organization members
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

  if (!members || members.length === 0) {
    return [];
  }

  // 2. Fetch corresponding profiles for member user_ids
  // Note: organization_members.user_id references auth.users(id), not public.profiles(id).
  // Therefore, PostgREST cannot perform an embedded resource join (which requires a public FK constraint).
  // The two-query pattern is the correct architectural approach.
  const userIds = members.map((m) => m.user_id);
  let profiles: Profile[] | null = null;

  const { data: fullProfiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, job_title, department, bio, location, created_at, updated_at")
    .in("id", userIds);

  if (profilesError) {
    // If extended columns (job_title, department, bio, location) do not exist yet, fallback to base columns
    if (profilesError.code === "42703" || profilesError.message?.includes("does not exist")) {
      const { data: baseProfiles, error: baseError } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, created_at, updated_at")
        .in("id", userIds);

      if (baseError) {
        logger.error("Error fetching member profiles (base fallback)", baseError, { organizationId });
      } else {
        profiles = (baseProfiles || []).map((p) => ({
          ...p,
          job_title: "",
          department: "",
          bio: "",
          location: "",
        })) as Profile[];
      }
    } else {
      logger.error("Error fetching member profiles", profilesError, { organizationId });
    }
  } else {
    profiles = fullProfiles as Profile[] | null;
  }

  const profilesMap = new Map((profiles || []).map((p) => [p.id, p]));

  // Auto-heal: If the currently authenticated user is in userIds but missing from profilesMap,
  // restore and persist their profile directly from their auth session (allowed by RLS: auth.uid() = id)
  try {
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData?.user;
    if (currentUser && userIds.includes(currentUser.id) && !profilesMap.has(currentUser.id)) {
      const restoredProfile: Profile = {
        id: currentUser.id,
        email: currentUser.email || "",
        full_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || null,
        avatar_url: currentUser.user_metadata?.avatar_url || null,
        created_at: currentUser.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        await supabase.from("profiles").upsert({
          id: restoredProfile.id,
          email: restoredProfile.email,
          full_name: restoredProfile.full_name,
          avatar_url: restoredProfile.avatar_url,
        });
      } catch {
        // Non-blocking if RLS/network blocks upsert
      }

      profilesMap.set(currentUser.id, restoredProfile);
    }
  } catch {
    // Non-blocking
  }

  // 3. Map members with their profile records
  return members.map((row) => {
    const prof = profilesMap.get(row.user_id);
    if (!prof) {
      logger.warn("getOrganizationMembers: Member user_id has no corresponding profile row in public.profiles", {
        memberId: row.id,
        userId: row.user_id,
        organizationId,
      });
    }

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
