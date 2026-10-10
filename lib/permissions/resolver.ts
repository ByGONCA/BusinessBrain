import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";
import { PermissionKey, isValidPermissionKey, PERMISSION_KEYS } from "./registry";

export interface ResolvedPermissions {
  isOwner: boolean;
  effectivePermissions: Set<string>;
  inheritedFromTeams: Record<string, string[]>; // permissionKey -> teamName[]
  explicitAllows: Set<string>;
  explicitDenies: Set<string>;
  memberRole: "owner" | "admin" | "member";
}

/**
 * Resolves user permissions following the Discord-style precedence:
 * 1. Owner -> unconditional full access (all keys allowed)
 * 2. Explicit DENY -> denied (overrides team allows)
 * 3. Explicit ALLOW -> allowed (individual override)
 * 4. Team permissions -> allowed if member belongs to any team granting the permission
 * 5. Default -> denied
 */
export const resolveUserPermissions = cache(
  async (userId: string, organizationId: string): Promise<ResolvedPermissions> => {
    if (!isValidUuid(userId) || !isValidUuid(organizationId)) {
      return {
        isOwner: false,
        effectivePermissions: new Set(),
        inheritedFromTeams: {},
        explicitAllows: new Set(),
        explicitDenies: new Set(),
        memberRole: "member",
      };
    }

    const supabase = await createClient();

    // 1. Fetch organization member role
    const { data: member, error: memberError } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError || !member) {
      return {
        isOwner: false,
        effectivePermissions: new Set(),
        inheritedFromTeams: {},
        explicitAllows: new Set(),
        explicitDenies: new Set(),
        memberRole: "member",
      };
    }

    const isOwner = member.role === "owner";

    // If Owner: Return root authority for all registered keys
    if (isOwner) {
      const allKeys = new Set(PERMISSION_KEYS);
      return {
        isOwner: true,
        effectivePermissions: allKeys,
        inheritedFromTeams: {},
        explicitAllows: new Set(),
        explicitDenies: new Set(),
        memberRole: "owner",
      };
    }

    // 2. Fetch Teams the user belongs to
    const { data: teamMemberships } = await supabase
      .from("organization_team_members")
      .select(`
        team_id,
        organization_teams (
          id,
          name
        )
      `)
      .eq("organization_id", organizationId)
      .eq("user_id", userId);

    const userTeamIds: string[] = [];
    const teamNameMap = new Map<string, string>();

    if (teamMemberships && teamMemberships.length > 0) {
      for (const tm of teamMemberships) {
        if (tm.team_id) {
          userTeamIds.push(tm.team_id);
          const tData = tm.organization_teams as unknown as { id: string; name: string } | null;
          if (tData?.name) {
            teamNameMap.set(tm.team_id, tData.name);
          }
        }
      }
    }

    // 3. Fetch Team Permissions
    const inheritedFromTeams: Record<string, string[]> = {};
    const teamAllowedKeys = new Set<string>();

    if (userTeamIds.length > 0) {
      const { data: teamPerms } = await supabase
        .from("team_permissions")
        .select("team_id, permission_key")
        .eq("organization_id", organizationId)
        .in("team_id", userTeamIds);

      if (teamPerms) {
        for (const tp of teamPerms) {
          const tName = teamNameMap.get(tp.team_id) || "Team";
          teamAllowedKeys.add(tp.permission_key);
          if (!inheritedFromTeams[tp.permission_key]) {
            inheritedFromTeams[tp.permission_key] = [];
          }
          if (!inheritedFromTeams[tp.permission_key].includes(tName)) {
            inheritedFromTeams[tp.permission_key].push(tName);
          }
        }
      }
    }

    // 4. Fetch Individual Member Overrides
    const explicitAllows = new Set<string>();
    const explicitDenies = new Set<string>();

    const { data: overrides } = await supabase
      .from("member_permission_overrides")
      .select("permission_key, effect")
      .eq("organization_id", organizationId)
      .eq("user_id", userId);

    if (overrides) {
      for (const ov of overrides) {
        if (ov.effect === "allow") {
          explicitAllows.add(ov.permission_key);
        } else if (ov.effect === "deny") {
          explicitDenies.add(ov.permission_key);
        }
      }
    }

    // 5. Compute Effective Permissions:
    // Precedence: explicitDenies > explicitAllows > teamAllowedKeys
    const effectivePermissions = new Set<string>();

    // Add all from team permissions unless explicitly denied
    for (const key of teamAllowedKeys) {
      if (!explicitDenies.has(key)) {
        effectivePermissions.add(key);
      }
    }

    // Add explicit allows (even if not in team, provided not in deny)
    for (const key of explicitAllows) {
      if (!explicitDenies.has(key)) {
        effectivePermissions.add(key);
      }
    }

    return {
      isOwner: false,
      effectivePermissions,
      inheritedFromTeams,
      explicitAllows,
      explicitDenies,
      memberRole: member.role as "owner" | "admin" | "member",
    };
  }
);

/**
 * High-performance server-side permission check.
 */
export async function hasPermission(
  userId: string,
  organizationId: string,
  permission: PermissionKey
): Promise<boolean> {
  const resolved = await resolveUserPermissions(userId, organizationId);
  if (resolved.isOwner) return true;
  return resolved.effectivePermissions.has(permission);
}
