"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";
import { resolveUserPermissions, hasPermission } from "./resolver";
import { PermissionKey, isValidPermissionKey } from "./registry";
import { SUGGESTED_TEAM_TEMPLATES } from "@/lib/organizations/catalog";

export interface TeamRecord {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  color: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  members_count?: number;
  member_user_ids?: string[];
  permissions?: string[];
}

export interface MemberDetailRecord {
  id: string;
  organization_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  job_title: string;
  department: string;
  created_at: string;
  profile?: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    bio?: string;
    location?: string;
  };
  teams: { id: string; name: string; color: string }[];
  effectivePermissions: string[];
  inheritedFromTeams: Record<string, string[]>;
  explicitAllows: string[];
  explicitDenies: string[];
  isOwner: boolean;
}

/**
 * Verifies active user has permission to manage teams/people.
 */
async function verifyManagementAccess(
  orgId: string,
  permission: PermissionKey
): Promise<{ userId: string; isOwner: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const resolved = await resolveUserPermissions(user.id, orgId);
  if (resolved.isOwner) {
    return { userId: user.id, isOwner: true };
  }

  if (!resolved.effectivePermissions.has(permission)) {
    throw new Error(`Forbidden: You do not have permission '${permission}'`);
  }

  return { userId: user.id, isOwner: false };
}

// ------------------------------------------------------------------------------
// TEAMS QUERIES & MUTATIONS
// ------------------------------------------------------------------------------

export async function getTeamsWithDetailsAction(organizationId?: string): Promise<{
  success: boolean;
  teams: TeamRecord[];
  error?: string;
}> {
  try {
    const activeOrg = await getActiveOrganization();
    const targetOrgId = organizationId || activeOrg?.id;
    if (!targetOrgId || !isValidUuid(targetOrgId)) {
      return { success: false, teams: [], error: "Invalid organization ID" };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, teams: [], error: "Unauthorized" };
    }

    // Defense-in-depth: If organizationId is explicitly provided and differs from activeOrg,
    // verify the caller is actually a member of targetOrgId.
    if (organizationId && (!activeOrg || activeOrg.id !== organizationId)) {
      const { data: member } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", targetOrgId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!member) {
        logger.warn("Unauthorized attempt to access organization teams", {
          userId: user.id,
          targetOrgId,
        });
        return { success: false, teams: [], error: "Unauthorized to access workspace." };
      }
    }

    // Verify caller has permission to view teams (Owners bypass automatically)
    const canView = await hasPermission(user.id, targetOrgId, "teams.view");
    if (!canView) {
      return { success: false, teams: [], error: "Forbidden: You do not have permission to view teams." };
    }

    // 1. Fetch teams
    const { data: rawTeams, error: teamsError } = await supabase
      .from("organization_teams")
      .select("*")
      .eq("organization_id", targetOrgId)
      .order("name", { ascending: true });

    if (teamsError) {
      logger.error("Failed to fetch teams", teamsError, { organizationId: targetOrgId });
      return { success: false, teams: [], error: teamsError.message };
    }

    const teams: TeamRecord[] = rawTeams || [];
    if (teams.length === 0) {
      return { success: true, teams: [] };
    }

    const teamIds = teams.map((t) => t.id);

    // 2. Fetch team members
    const { data: teamMembers } = await supabase
      .from("organization_team_members")
      .select("team_id, user_id")
      .eq("organization_id", targetOrgId)
      .in("team_id", teamIds);

    // 3. Fetch team permissions
    const { data: teamPerms } = await supabase
      .from("team_permissions")
      .select("team_id, permission_key")
      .eq("organization_id", targetOrgId)
      .in("team_id", teamIds);

    const membersByTeam = new Map<string, string[]>();
    if (teamMembers) {
      for (const tm of teamMembers) {
        if (!membersByTeam.has(tm.team_id)) membersByTeam.set(tm.team_id, []);
        membersByTeam.get(tm.team_id)!.push(tm.user_id);
      }
    }

    const permsByTeam = new Map<string, string[]>();
    if (teamPerms) {
      for (const tp of teamPerms) {
        if (!permsByTeam.has(tp.team_id)) permsByTeam.set(tp.team_id, []);
        permsByTeam.get(tp.team_id)!.push(tp.permission_key);
      }
    }

    const enrichedTeams: TeamRecord[] = teams.map((t) => ({
      ...t,
      member_user_ids: membersByTeam.get(t.id) || [],
      members_count: (membersByTeam.get(t.id) || []).length,
      permissions: permsByTeam.get(t.id) || [],
    }));

    return { success: true, teams: enrichedTeams };
  } catch (err: unknown) {
    logger.error("Unexpected error in getTeamsWithDetailsAction", err);
    return { success: false, teams: [], error: "Failed to fetch teams" };
  }
}

export async function createTeamAction(params: {
  name: string;
  description?: string;
  color?: string;
  initialMemberUserIds?: string[];
  initialPermissions?: string[];
}): Promise<{ success: boolean; team?: TeamRecord; error?: string }> {
  try {
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };

    const { userId } = await verifyManagementAccess(activeOrg.id, "teams.create");

    const trimmedName = params.name.trim();
    if (!trimmedName) return { success: false, error: "Team name is required" };

    const supabase = await createClient();

    const { data: team, error } = await supabase
      .from("organization_teams")
      .insert({
        organization_id: activeOrg.id,
        name: trimmedName,
        description: params.description?.trim() || "",
        color: params.color || "blue",
        created_by: userId,
      })
      .select("*")
      .single();

    if (error || !team) {
      return { success: false, error: error?.message || "Failed to create team" };
    }

    // Add initial members if provided
    if (params.initialMemberUserIds && params.initialMemberUserIds.length > 0) {
      const inserts = params.initialMemberUserIds
        .filter((uid) => isValidUuid(uid))
        .map((uid) => ({
          organization_id: activeOrg.id,
          team_id: team.id,
          user_id: uid,
        }));

      if (inserts.length > 0) {
        await supabase.from("organization_team_members").insert(inserts);
      }
    }

    // Add initial permissions if provided
    if (params.initialPermissions && params.initialPermissions.length > 0) {
      const pInserts = params.initialPermissions
        .filter((k) => isValidPermissionKey(k))
        .map((k) => ({
          organization_id: activeOrg.id,
          team_id: team.id,
          permission_key: k,
        }));

      if (pInserts.length > 0) {
        await supabase.from("team_permissions").insert(pInserts);
      }
    }

    revalidatePath("/dashboard/people");
    return { success: true, team };
  } catch (err: unknown) {
    logger.error("Error creating team", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create team" };
  }
}

/**
 * Applies standard team templates to an organization optionally and idempotently.
 * Never creates duplicate teams (matches existing teams by name case-insensitively).
 * Requires teams.create permission or Owner role.
 */
export async function applyTeamTemplatesAction(params?: {
  templateIds?: string[];
  organizationId?: string;
}): Promise<{
  success: boolean;
  createdCount: number;
  skippedCount: number;
  createdTeams: TeamRecord[];
  error?: string;
}> {
  try {
    const activeOrg = await getActiveOrganization();
    const targetOrgId = params?.organizationId || activeOrg?.id;
    if (!targetOrgId || !isValidUuid(targetOrgId)) {
      return { success: false, createdCount: 0, skippedCount: 0, createdTeams: [], error: "No active workspace" };
    }

    const { userId } = await verifyManagementAccess(targetOrgId, "teams.create");
    const supabase = await createClient();

    // Fetch existing teams for this organization to prevent duplicate creation
    const { data: existingTeams, error: fetchErr } = await supabase
      .from("organization_teams")
      .select("id, name")
      .eq("organization_id", targetOrgId);

    if (fetchErr) {
      logger.error("Failed to query existing teams before applying templates", fetchErr, { targetOrgId });
      return { success: false, createdCount: 0, skippedCount: 0, createdTeams: [], error: fetchErr.message };
    }

    const existingNames = new Set((existingTeams || []).map((t) => t.name.trim().toLowerCase()));

    const templatesToConsider =
      params?.templateIds && params.templateIds.length > 0
        ? SUGGESTED_TEAM_TEMPLATES.filter((t) => params.templateIds!.includes(t.id))
        : SUGGESTED_TEAM_TEMPLATES;

    const templatesToCreate = templatesToConsider.filter(
      (t) => !existingNames.has(t.name.trim().toLowerCase())
    );

    const skippedCount = templatesToConsider.length - templatesToCreate.length;

    if (templatesToCreate.length === 0) {
      return {
        success: true,
        createdCount: 0,
        skippedCount,
        createdTeams: [],
      };
    }

    const inserts = templatesToCreate.map((t) => ({
      organization_id: targetOrgId,
      name: t.name,
      description: t.description,
      color: t.color,
      created_by: userId,
    }));

    const { data: createdRows, error: insertErr } = await supabase
      .from("organization_teams")
      .insert(inserts)
      .select("*");

    if (insertErr || !createdRows) {
      logger.error("Failed to insert template teams", insertErr, { targetOrgId });
      return {
        success: false,
        createdCount: 0,
        skippedCount,
        createdTeams: [],
        error: insertErr?.message || "Failed to create teams",
      };
    }

    revalidatePath("/dashboard/people");
    return {
      success: true,
      createdCount: createdRows.length,
      skippedCount,
      createdTeams: createdRows as TeamRecord[],
    };
  } catch (err: unknown) {
    logger.error("Unexpected error in applyTeamTemplatesAction", err);
    return {
      success: false,
      createdCount: 0,
      skippedCount: 0,
      createdTeams: [],
      error: err instanceof Error ? err.message : "Failed to apply templates",
    };
  }
}

export async function updateTeamAction(params: {
  teamId: string;
  name?: string;
  description?: string;
  color?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };
    if (!isValidUuid(params.teamId)) return { success: false, error: "Invalid team ID" };

    await verifyManagementAccess(activeOrg.id, "teams.edit");

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof params.name === "string" && params.name.trim()) {
      updates.name = params.name.trim();
    }
    if (typeof params.description === "string") {
      updates.description = params.description.trim();
    }
    if (typeof params.color === "string") {
      updates.color = params.color;
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("organization_teams")
      .update(updates)
      .eq("id", params.teamId)
      .eq("organization_id", activeOrg.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/people");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update team" };
  }
}

export async function deleteTeamAction(teamId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };
    if (!isValidUuid(teamId)) return { success: false, error: "Invalid team ID" };

    await verifyManagementAccess(activeOrg.id, "teams.delete");

    const supabase = await createClient();
    const { error } = await supabase
      .from("organization_teams")
      .delete()
      .eq("id", teamId)
      .eq("organization_id", activeOrg.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/people");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete team" };
  }
}

export async function assignMemberToTeamAction(params: {
  teamId: string;
  userId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };
    if (!isValidUuid(params.teamId) || !isValidUuid(params.userId)) {
      return { success: false, error: "Invalid team or user ID" };
    }

    await verifyManagementAccess(activeOrg.id, "teams.manage_members");

    const supabase = await createClient();
    const { error } = await supabase.from("organization_team_members").insert({
      organization_id: activeOrg.id,
      team_id: params.teamId,
      user_id: params.userId,
    });

    if (error && error.code !== "23505") {
      // 23505 is unique violation (already assigned), safe to ignore
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/people");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to assign member" };
  }
}

export async function removeMemberFromTeamAction(params: {
  teamId: string;
  userId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };
    if (!isValidUuid(params.teamId) || !isValidUuid(params.userId)) {
      return { success: false, error: "Invalid team or user ID" };
    }

    await verifyManagementAccess(activeOrg.id, "teams.manage_members");

    const supabase = await createClient();
    const { error } = await supabase
      .from("organization_team_members")
      .delete()
      .eq("team_id", params.teamId)
      .eq("user_id", params.userId)
      .eq("organization_id", activeOrg.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/people");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to remove member" };
  }
}

export async function updateTeamPermissionsAction(params: {
  teamId: string;
  permissionKeys: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };
    if (!isValidUuid(params.teamId)) return { success: false, error: "Invalid team ID" };

    await verifyManagementAccess(activeOrg.id, "teams.manage_permissions");

    const validKeys = params.permissionKeys.filter(isValidPermissionKey);

    const supabase = await createClient();

    // Remove existing
    await supabase
      .from("team_permissions")
      .delete()
      .eq("team_id", params.teamId)
      .eq("organization_id", activeOrg.id);

    // Insert new
    if (validKeys.length > 0) {
      const inserts = validKeys.map((key) => ({
        organization_id: activeOrg.id,
        team_id: params.teamId,
        permission_key: key,
      }));
      const { error: insertError } = await supabase.from("team_permissions").insert(inserts);
      if (insertError) return { success: false, error: insertError.message };
    }

    revalidatePath("/dashboard/people");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update permissions" };
  }
}

// ------------------------------------------------------------------------------
// INDIVIDUAL PERMISSIONS & MEMBER DETAILS
// ------------------------------------------------------------------------------

export async function getMemberDetailsAction(userId: string): Promise<{
  success: boolean;
  member?: MemberDetailRecord;
  error?: string;
}> {
  try {
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };
    if (!isValidUuid(userId)) return { success: false, error: "Invalid user ID" };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    // If querying another member's details, require people.view permission or owner role
    if (user.id !== userId) {
      const canView = await hasPermission(user.id, activeOrg.id, "people.view");
      if (!canView) {
        return {
          success: false,
          error: "Forbidden: You do not have permission to view member details.",
        };
      }
    }

    // 1. Fetch organization member record
    const { data: member, error: memberError } = await supabase
      .from("organization_members")
      .select("id, organization_id, user_id, role, job_title, department, created_at")
      .eq("organization_id", activeOrg.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError || !member) {
      return { success: false, error: "Member not found" };
    }

    // 2. Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, bio, location, job_title, department")
      .eq("id", userId)
      .maybeSingle();

    // 3. Fetch user teams
    const { data: teamMemberships } = await supabase
      .from("organization_team_members")
      .select(`
        team_id,
        organization_teams (
          id,
          name,
          color
        )
      `)
      .eq("organization_id", activeOrg.id)
      .eq("user_id", userId);

    const userTeams = (teamMemberships || [])
      .map((tm) => tm.organization_teams as unknown as { id: string; name: string; color: string } | null)
      .filter((t): t is { id: string; name: string; color: string } => Boolean(t));

    // 4. Resolve permissions
    const resolved = await resolveUserPermissions(userId, activeOrg.id);

    const detail: MemberDetailRecord = {
      id: member.id,
      organization_id: member.organization_id,
      user_id: member.user_id,
      role: member.role as "owner" | "admin" | "member",
      job_title: member.job_title || profile?.job_title || "",
      department: member.department || profile?.department || "",
      created_at: member.created_at,
      profile: profile
        ? {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            bio: profile.bio || "",
            location: profile.location || "",
          }
        : undefined,
      teams: userTeams,
      effectivePermissions: Array.from(resolved.effectivePermissions),
      inheritedFromTeams: resolved.inheritedFromTeams,
      explicitAllows: Array.from(resolved.explicitAllows),
      explicitDenies: Array.from(resolved.explicitDenies),
      isOwner: resolved.isOwner,
    };

    return { success: true, member: detail };
  } catch (err: unknown) {
    logger.error("Error in getMemberDetailsAction", err);
    return { success: false, error: "Failed to get member details" };
  }
}

export async function setMemberPermissionOverrideAction(params: {
  targetUserId: string;
  permissionKey: string;
  effect: "allow" | "deny" | "inherit"; // inherit removes the override
}): Promise<{ success: boolean; error?: string }> {
  try {
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };
    if (!isValidUuid(params.targetUserId)) return { success: false, error: "Invalid user ID" };
    if (!isValidPermissionKey(params.permissionKey)) return { success: false, error: "Invalid permission key" };

    const { userId: callerId } = await verifyManagementAccess(activeOrg.id, "people.manage_permissions");

    const supabase = await createClient();

    // Prevent modifying owner
    const { data: targetMember } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", activeOrg.id)
      .eq("user_id", params.targetUserId)
      .maybeSingle();

    if (targetMember?.role === "owner") {
      return { success: false, error: "Cannot override permissions for the workspace Owner." };
    }

    if (params.effect === "inherit") {
      // Delete override so it falls back to team / default
      await supabase
        .from("member_permission_overrides")
        .delete()
        .eq("organization_id", activeOrg.id)
        .eq("user_id", params.targetUserId)
        .eq("permission_key", params.permissionKey);
    } else {
      // Upsert override
      const { error } = await supabase
        .from("member_permission_overrides")
        .upsert(
          {
            organization_id: activeOrg.id,
            user_id: params.targetUserId,
            permission_key: params.permissionKey,
            effect: params.effect,
            granted_by: callerId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,user_id,permission_key" }
        );

      if (error) return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/people");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to set permission override" };
  }
}

export async function updateMemberJobInfoAction(params: {
  targetUserId: string;
  jobTitle?: string;
  department?: string;
  bio?: string;
  location?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) return { success: false, error: "No active workspace" };
    if (!isValidUuid(params.targetUserId)) return { success: false, error: "Invalid user ID" };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Allow user to edit their own informational info, or require people.edit permission
    if (user.id !== params.targetUserId) {
      await verifyManagementAccess(activeOrg.id, "people.edit");
    }

    const memberUpdates: Record<string, unknown> = {};
    const profileUpdates: Record<string, unknown> = {};

    if (params.jobTitle !== undefined) {
      memberUpdates.job_title = params.jobTitle.trim();
      profileUpdates.job_title = params.jobTitle.trim();
    }
    if (params.department !== undefined) {
      memberUpdates.department = params.department.trim();
      profileUpdates.department = params.department.trim();
    }
    if (params.bio !== undefined) {
      profileUpdates.bio = params.bio.trim();
    }
    if (params.location !== undefined) {
      profileUpdates.location = params.location.trim();
    }

    if (Object.keys(memberUpdates).length > 0) {
      await supabase
        .from("organization_members")
        .update(memberUpdates)
        .eq("organization_id", activeOrg.id)
        .eq("user_id", params.targetUserId);
    }

    if (Object.keys(profileUpdates).length > 0) {
      await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", params.targetUserId);
    }

    revalidatePath("/dashboard/people");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update member information" };
  }
}
