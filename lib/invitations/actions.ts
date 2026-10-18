"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization, ACTIVE_ORG_COOKIE_NAME } from "@/lib/organizations/queries";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { hasPermission } from "@/lib/permissions/resolver";
import {
  OrganizationInvitation,
  CreateInvitationResult,
  AcceptInvitationResult,
  InvitationRole,
} from "./types";

const emailSchema = z.string().trim().email("Please provide a valid email address").max(255);

/**
 * Checks if a Supabase/PostgreSQL error specifically indicates that optional columns
 * (e.g. job_title or initial_team_ids from migration 00022) do not exist yet on the remote database.
 * Does NOT swallow constraint violations, authentication/RLS errors, or connection failures.
 */
function isUndefinedColumnError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return (
    err.code === "42703" ||
    (typeof err.message === "string" &&
      (err.message.includes("job_title") || err.message.includes("initial_team_ids") || err.message.includes("column")) &&
      (err.code?.startsWith("42") || !err.code))
  );
}

/**
 * Creates and dispatches a secure single-use organization invitation.
 * Requires people.invite permission or Owner role.
 */
export async function createInvitationAction(params: {
  email: string;
  role?: InvitationRole;
  organizationId?: string;
  jobTitle?: string;
  initialTeamIds?: string[];
}): Promise<CreateInvitationResult> {
  const parsedEmail = emailSchema.safeParse(params.email);
  if (!parsedEmail.success) {
    return { success: false, error: parsedEmail.error.errors[0]?.message || "Invalid email address." };
  }
  const cleanEmail = parsedEmail.data.toLowerCase();
  const role: InvitationRole = params.role === "admin" ? "admin" : "member";
  const cleanJobTitle = params.jobTitle ? params.jobTitle.trim() : "";

  const activeOrg = await getActiveOrganization();
  const targetOrgId = params.organizationId || activeOrg?.id;
  if (!targetOrgId || !isValidUuid(targetOrgId)) {
    return { success: false, error: "Invalid organization ID." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  // Rate limit invitation creation per user
  const rl = await rateLimit("create-invitation", user.id, RATE_LIMIT_PRESETS.MUTATIONS);
  if (!rl.success) {
    return { success: false, error: "Too many invitations created. Please wait a moment." };
  }

  // Verify permission: caller must have people.invite or be Owner
  const canInvite = await hasPermission(user.id, targetOrgId, "people.invite");
  if (!canInvite) {
    return { success: false, error: "Forbidden: You do not have permission to invite new members." };
  }

  // Validate initial team IDs if provided: ensure they belong strictly to this targetOrgId
  let validatedTeamIds: string[] = [];
  if (params.initialTeamIds && Array.isArray(params.initialTeamIds) && params.initialTeamIds.length > 0) {
    const candidateUuids = params.initialTeamIds.filter((id) => typeof id === "string" && isValidUuid(id));
    if (candidateUuids.length > 0) {
      const { data: dbTeams } = await supabase
        .from("organization_teams")
        .select("id")
        .eq("organization_id", targetOrgId)
        .in("id", candidateUuids);

      if (dbTeams) {
        validatedTeamIds = dbTeams.map((t) => t.id);
      }
    }
  }

  // 1. Check if the invited user is already a member of the workspace
  const { data: existingProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", cleanEmail);

  if (existingProfiles && existingProfiles.length > 0) {
    const existingUserIds = existingProfiles.map((p) => p.id);
    const { data: existingMembership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", targetOrgId)
      .in("user_id", existingUserIds)
      .maybeSingle();

    if (existingMembership) {
      return { success: false, error: "This user is already an active member of this workspace." };
    }
  }

  // 2. Check for duplicate pending invitation
  const { data: pendingInvite } = await supabase
    .from("organization_invitations")
    .select("id, expires_at, status")
    .eq("organization_id", targetOrgId)
    .eq("email", cleanEmail)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingInvite) {
    const isExpired = new Date(pendingInvite.expires_at) < new Date();
    if (!isExpired) {
      return {
        success: false,
        error: "A pending invitation for this email address already exists. You can resend it instead.",
      };
    } else {
      // Mark old as expired
      await supabase
        .from("organization_invitations")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", pendingInvite.id);
    }
  }

  // 3. Generate cryptographically secure single-use token and its SHA-256 hash
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // 4. Insert invitation record (with fallback if migration 00022 or 00024 has not run yet)
  const invitePayload: Record<string, unknown> = {
    organization_id: targetOrgId,
    email: cleanEmail,
    role,
    token_hash: tokenHash,
    token: null,
    status: "pending",
    invited_by: user.id,
    expires_at: expiresAt,
    job_title: cleanJobTitle,
    initial_team_ids: validatedTeamIds,
  };

  let { data: newInvite, error: insertError } = await supabase
    .from("organization_invitations")
    .insert(invitePayload)
    .select("*")
    .single();

  // Fallback: If migration 00022 has not run yet (missing optional job_title / initial_team_ids)
  if (insertError && isUndefinedColumnError(insertError) && (insertError.message?.includes("job_title") || insertError.message?.includes("initial_team_ids"))) {
    delete invitePayload.job_title;
    delete invitePayload.initial_team_ids;
    const fallbackRes = await supabase
      .from("organization_invitations")
      .insert(invitePayload)
      .select("id, organization_id, email, role, status, invited_by, expires_at, created_at, updated_at")
      .single();
    newInvite = fallbackRes.data;
    insertError = fallbackRes.error;
  }

  if (insertError || !newInvite) {
    logger.error("Failed to insert organization invitation", insertError, { targetOrgId });
    if (insertError && isUndefinedColumnError(insertError) && insertError.message?.includes("token_hash")) {
      return { success: false, error: "Database migration required: token_hash column missing." };
    }
    return { success: false, error: insertError?.message || "Failed to create invitation." };
  }


  // Record audit log entry
  try {
    await supabase.from("audit_logs").insert({
      organization_id: targetOrgId,
      actor_id: user.id,
      actor_name: user.user_metadata?.full_name || user.email || "Member",
      actor_email: user.email,
      action: "invitation.created",
      resource_type: "organization_invitation",
      resource_name: cleanEmail,
      metadata: { role, invitation_id: newInvite.id },
    });
  } catch {}

  revalidatePath("/dashboard/people");

  // Construct single-use acceptance link
  const inviteLink = `/invite/${token}`;

  return {
    success: true,
    invitation: newInvite as OrganizationInvitation,
    inviteLink,
  };
}

/**
 * Retrieves all invitations for an organization.
 * Automatically marks expired pending invitations.
 * Masks tokens to prevent unauthorized exposure.
 */
export async function getOrganizationInvitationsAction(
  organizationId?: string
): Promise<{ success: boolean; invitations: OrganizationInvitation[]; error?: string }> {
  const activeOrg = await getActiveOrganization();
  const targetOrgId = organizationId || activeOrg?.id;
  if (!targetOrgId || !isValidUuid(targetOrgId)) {
    return { success: false, invitations: [], error: "Invalid organization ID." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, invitations: [], error: "Authentication required." };
  }

  // Require people.view or people.invite permission (Owner automatically allowed)
  const canView =
    (await hasPermission(user.id, targetOrgId, "people.view")) ||
    (await hasPermission(user.id, targetOrgId, "people.invite"));

  if (!canView) {
    return { success: false, invitations: [], error: "Forbidden: You do not have permission to view invitations." };
  }

  try {
    // 1. Automatically update overdue pending invitations to expired
    await supabase
      .from("organization_invitations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("organization_id", targetOrgId)
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

    // 2. Fetch invitations (omitting raw token column, with fallback if migration 00022 hasn't run)
    let rawInvites: unknown[] | null = null;
    let fetchError: { message: string } | null = null;

    const fullSelect = await supabase
      .from("organization_invitations")
      .select("id, organization_id, email, role, status, job_title, initial_team_ids, invited_by, expires_at, created_at, updated_at")
      .eq("organization_id", targetOrgId)
      .order("created_at", { ascending: false });

    if (fullSelect.error && isUndefinedColumnError(fullSelect.error)) {
      const fallbackSelect = await supabase
        .from("organization_invitations")
        .select("id, organization_id, email, role, status, invited_by, expires_at, created_at, updated_at")
        .eq("organization_id", targetOrgId)
        .order("created_at", { ascending: false });
      rawInvites = fallbackSelect.data;
      fetchError = fallbackSelect.error;
    } else {
      rawInvites = fullSelect.data;
      fetchError = fullSelect.error;
    }

    if (fetchError) {
      logger.error("Failed to fetch organization invitations", fetchError, { targetOrgId });
      return { success: false, invitations: [], error: fetchError.message };
    }

    return { success: true, invitations: (rawInvites || []) as OrganizationInvitation[] };
  } catch (err: unknown) {
    logger.error("Exception in getOrganizationInvitationsAction", err, { targetOrgId });
    return { success: false, invitations: [], error: "Failed to load invitations." };
  }
}

/**
 * Revokes a pending organization invitation.
 * Requires people.invite or people.remove permission or Owner role.
 */
export async function revokeInvitationAction(invitationId: string): Promise<{ success: boolean; error?: string }> {
  if (!isValidUuid(invitationId)) {
    return { success: false, error: "Invalid invitation ID." };
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return { success: false, error: "No active workspace." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const canRevoke =
    (await hasPermission(user.id, activeOrg.id, "people.invite")) ||
    (await hasPermission(user.id, activeOrg.id, "people.remove"));

  if (!canRevoke) {
    return { success: false, error: "Forbidden: You do not have permission to revoke invitations." };
  }

  const { error } = await supabase
    .from("organization_invitations")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("organization_id", activeOrg.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/people");
  return { success: true };
}

/**
 * Resends an existing organization invitation with a fresh token and 7-day expiration.
 * Requires people.invite permission or Owner role.
 */
export async function resendInvitationAction(
  invitationId: string
): Promise<{ success: boolean; inviteLink?: string; error?: string }> {
  if (!isValidUuid(invitationId)) {
    return { success: false, error: "Invalid invitation ID." };
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return { success: false, error: "No active workspace." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const canInvite = await hasPermission(user.id, activeOrg.id, "people.invite");
  if (!canInvite) {
    return { success: false, error: "Forbidden: You do not have permission to manage invitations." };
  }

  const newToken = crypto.randomBytes(32).toString("hex");
  const newTokenHash = crypto.createHash("sha256").update(newToken).digest("hex");
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  let { error } = await supabase
    .from("organization_invitations")
    .update({
      token_hash: newTokenHash,
      token: null,
      status: "pending",
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("organization_id", activeOrg.id);

  if (error) {
    logger.error("Failed to resend invitation", error, { invitationId });
    if (isUndefinedColumnError(error) && error.message?.includes("token_hash")) {
      return { success: false, error: "Database migration required: token_hash column is missing." };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/people");
  return { success: true, inviteLink: `/invite/${newToken}` };
}

/**
 * Accepts an invitation using a single-use token.
 * Validates expiration, organization state, caller account, and adds user to organization_members.
 */
export async function acceptInvitationAction(token: string): Promise<AcceptInvitationResult> {
  const cleanToken = token.trim();
  if (!cleanToken || cleanToken.length < 16) {
    return { success: false, error: "Invalid invitation token." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Authentication required. Please sign in or register to accept." };
  }

  // 1. Compute SHA-256 hash of the token
  const tokenHash = crypto.createHash("sha256").update(cleanToken).digest("hex");

  // 2. Attempt atomic PostgreSQL RPC execution (FOR UPDATE, strict identity validation, role and team guards)
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("accept_organization_invitation", {
      p_token_hash: tokenHash,
    });

    if (!rpcError && rpcData) {
      const res = rpcData as { success: boolean; organization_id?: string; error?: string; code?: string };
      if (res.success && res.organization_id) {
        // Set active organization cookie
        const cookieStore = await cookies();
        cookieStore.set(ACTIVE_ORG_COOKIE_NAME, res.organization_id, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30,
        });

        revalidatePath("/", "layout");
        return {
          success: true,
          organizationId: res.organization_id,
        };
      } else if (!res.success && res.error) {
        return { success: false, error: res.error };
      }
    }

    if (rpcError) {
      // Check for security access denied violation from PostgreSQL
      if (rpcError.code === "42501" || rpcError.message?.includes("Access denied")) {
        return {
          success: false,
          error: rpcError.message || "Access denied: This invitation was issued to a different email address.",
        };
      }
      // If error is not "function does not exist", log it
      if (rpcError.code !== "42883" && rpcError.code !== "PGRST202") {
        logger.warn("RPC accept_organization_invitation failed, attempting fallback", {
          code: rpcError.code,
          message: rpcError.message,
        });
      }
    }
  } catch (rpcErr) {
    logger.warn("RPC invocation threw exception, falling back to application logic", {
      error: rpcErr instanceof Error ? rpcErr.message : String(rpcErr),
    });
  }

  // 3. Fallback path for unmigrated databases (with STRICT identity validation and atomic status lock)
  interface InvitationRecordWithOrg {
    id: string;
    organization_id: string;
    email: string;
    role: "admin" | "member";
    status: string;
    expires_at: string;
    job_title?: string;
    initial_team_ids?: string[];
    organizations: { id: string; name: string; status: string } | null;
  }

  let invitation: InvitationRecordWithOrg | null = null;
  let inviteError: { message: string } | null = null;

  // Strict hash lookup: Query ONLY by deterministic SHA-256 token_hash
  const resByHash = await supabase
    .from("organization_invitations")
    .select(`
      id,
      organization_id,
      email,
      role,
      status,
      job_title,
      initial_team_ids,
      expires_at,
      organizations (
        id,
        name,
        status
      )
    `)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (resByHash.error && isUndefinedColumnError(resByHash.error)) {
    logger.error("Database schema error: token_hash column missing in organization_invitations", resByHash.error);
    return {
      success: false,
      error: "Secure invitation verification unavailable. Please ensure database migrations (00024) are applied.",
    };
  }

  invitation = resByHash.data as unknown as InvitationRecordWithOrg | null;
  inviteError = resByHash.error;

  if (inviteError || !invitation) {
    return { success: false, error: "Invalid or nonexistent invitation." };
  }

  // Validate status and expiration
  if (invitation.status !== "pending") {
    return { success: false, error: `This invitation has already been ${invitation.status}.` };
  }

  if (new Date(invitation.expires_at) < new Date()) {
    await supabase
      .from("organization_invitations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", invitation.id);
    return { success: false, error: "This invitation has expired. Please request a new one." };
  }

  const org = invitation.organizations as unknown as { id: string; name: string; status: string } | null;
  if (!org || org.status !== "active") {
    return { success: false, error: "The workspace is no longer active." };
  }

  // STRICT IDENTITY VALIDATION (SEC-01): User email MUST match invited email
  if (!user.email || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    logger.warn("Blocked attempt to accept invitation issued to different email", {
      userEmail: user.email,
      invitedEmail: invitation.email,
      invitationId: invitation.id,
    });
    return {
      success: false,
      error: `Access denied: This invitation was issued to ${invitation.email}. Please sign in with that account to accept.`,
    };
  }

  // ATOMIC SINGLE-USE LOCK: Transition to accepted FIRST before mutating memberships
  const { data: updateRes, error: updateErr } = await supabase
    .from("organization_invitations")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", invitation.id)
    .eq("status", "pending")
    .select("id");

  if (updateErr || !updateRes || updateRes.length === 0) {
    return { success: false, error: "This invitation has already been accepted or is no longer valid." };
  }

  // Add user as organization member
  const { data: existingMember } = await supabase
    .from("organization_members")
    .select("id, job_title")
    .eq("organization_id", invitation.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingMember) {
    const memberInsert: Record<string, unknown> = {
      organization_id: invitation.organization_id,
      user_id: user.id,
      role: invitation.role,
    };
    if (invitation.job_title && invitation.job_title.trim()) {
      memberInsert.job_title = invitation.job_title.trim();
    }

    const { error: memberError } = await supabase.from("organization_members").insert(memberInsert);
    if (memberError) {
      logger.error("Failed to add user to organization_members", memberError);
      return { success: false, error: "Failed to join organization. Please try again." };
    }
  } else if (invitation.job_title && invitation.job_title.trim() && !existingMember.job_title) {
    await supabase
      .from("organization_members")
      .update({ job_title: invitation.job_title.trim() })
      .eq("id", existingMember.id);
  }

  // Assign initial teams strictly validated to this organization
  if (
    invitation.initial_team_ids &&
    Array.isArray(invitation.initial_team_ids) &&
    invitation.initial_team_ids.length > 0
  ) {
    const candidateTeamIds = invitation.initial_team_ids.filter((tid: string) => typeof tid === "string" && isValidUuid(tid));
    if (candidateTeamIds.length > 0) {
      const { data: validTeams } = await supabase
        .from("organization_teams")
        .select("id")
        .eq("organization_id", invitation.organization_id)
        .in("id", candidateTeamIds);

      if (validTeams && validTeams.length > 0) {
        for (const vt of validTeams) {
          const { data: existingTm } = await supabase
            .from("organization_team_members")
            .select("id")
            .eq("organization_id", invitation.organization_id)
            .eq("team_id", vt.id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!existingTm) {
            await supabase.from("organization_team_members").insert({
              organization_id: invitation.organization_id,
              team_id: vt.id,
              user_id: user.id,
            });
          }
        }
      }
    }
  }

  // Set active organization cookie
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE_NAME, invitation.organization_id, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/", "layout");
  return {
    success: true,
    organizationId: invitation.organization_id,
    organizationName: org.name,
  };
}

/**
 * Updates an organization member's system role (Owner / Admin / Member).
 * Strict protections:
 * - Only the Owner can change roles.
 * - Members cannot change their own roles.
 * - Cannot demote the final Owner.
 */
export async function updateMemberRoleAction(params: {
  targetUserId: string;
  newRole: "owner" | "admin" | "member";
  organizationId?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isValidUuid(params.targetUserId)) {
    return { success: false, error: "Invalid user ID." };
  }

  const activeOrg = await getActiveOrganization();
  const targetOrgId = params.organizationId || activeOrg?.id;
  if (!targetOrgId || !isValidUuid(targetOrgId)) {
    return { success: false, error: "Invalid organization ID." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  // Verify caller membership and role
  const { data: callerMember } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", targetOrgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!callerMember || callerMember.role !== "owner") {
    return { success: false, error: "Forbidden: Only the workspace Owner can change member roles." };
  }

  // Members cannot change their own role
  if (user.id === params.targetUserId) {
    return { success: false, error: "You cannot change your own system role." };
  }

  // Check target member's current role
  const { data: targetMember } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", targetOrgId)
    .eq("user_id", params.targetUserId)
    .maybeSingle();

  if (!targetMember) {
    return { success: false, error: "Member not found in workspace." };
  }

  // Final Owner protection: If demoting an owner, verify there is at least one other owner
  if (targetMember.role === "owner" && params.newRole !== "owner") {
    const { count, error: countError } = await supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", targetOrgId)
      .eq("role", "owner");

    if (countError || (count !== null && count <= 1)) {
      return {
        success: false,
        error: "Cannot demote the final Owner of the workspace. Promote another member to Owner first.",
      };
    }
  }

  const { error: updateError } = await supabase
    .from("organization_members")
    .update({ role: params.newRole, updated_at: new Date().toISOString() })
    .eq("organization_id", targetOrgId)
    .eq("user_id", params.targetUserId);

  if (updateError) {
    logger.error("Failed to update member role", updateError);
    return { success: false, error: updateError.message };
  }

  revalidatePath("/dashboard/people");
  return { success: true };
}

/**
 * Removes a member from an organization.
 * Strict protections:
 * - Requires people.remove permission or Owner role.
 * - Cannot remove the final Owner.
 * - Cleans up team memberships and overrides.
 */
export async function removeMemberAction(params: {
  targetUserId: string;
  organizationId?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isValidUuid(params.targetUserId)) {
    return { success: false, error: "Invalid user ID." };
  }

  const activeOrg = await getActiveOrganization();
  const targetOrgId = params.organizationId || activeOrg?.id;
  if (!targetOrgId || !isValidUuid(targetOrgId)) {
    return { success: false, error: "Invalid organization ID." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const isSelf = user.id === params.targetUserId;

  // If not removing self, verify people.remove permission or Owner
  if (!isSelf) {
    const canRemove = await hasPermission(user.id, targetOrgId, "people.remove");
    if (!canRemove) {
      return { success: false, error: "Forbidden: You do not have permission to remove members." };
    }
  }

  // Check target member's current role
  const { data: targetMember } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", targetOrgId)
    .eq("user_id", params.targetUserId)
    .maybeSingle();

  if (!targetMember) {
    return { success: false, error: "Member not found in workspace." };
  }

  // Final Owner protection: Cannot remove the final Owner
  if (targetMember.role === "owner") {
    const { count, error: countError } = await supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", targetOrgId)
      .eq("role", "owner");

    if (countError || (count !== null && count <= 1)) {
      return {
        success: false,
        error: "Cannot remove the final Owner of the workspace. Transfer ownership first.",
      };
    }
  }

  // Delete team memberships
  await supabase
    .from("organization_team_members")
    .delete()
    .eq("organization_id", targetOrgId)
    .eq("user_id", params.targetUserId);

  // Delete individual permission overrides
  await supabase
    .from("member_permission_overrides")
    .delete()
    .eq("organization_id", targetOrgId)
    .eq("user_id", params.targetUserId);

  // Delete membership
  const { error: deleteError } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", targetOrgId)
    .eq("user_id", params.targetUserId);

  if (deleteError) {
    logger.error("Failed to remove organization member", deleteError);
    return { success: false, error: deleteError.message };
  }

  revalidatePath("/dashboard/people");
  return { success: true };
}
