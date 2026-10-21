"use client";

import * as React from "react";
import {
  Mail,
  Shield,
  Briefcase,
  Building2,
  Calendar,
  Check,
  X,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Settings,
  Trash2,
  FolderGit2,
  ShieldCheck,
  ExternalLink,
  Edit2,
  UserCheck,
  Ban,
  ChevronDown,
  ChevronRight,
  Info,
  Send,
  Copy,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Layers,
} from "lucide-react";
import {
  PhosphorUsers,
  PhosphorUserList,
  PhosphorUserPlus,
  PhosphorUserMinus,
  PhosphorUserGear,
  PhosphorArrowsClockwise,
  PhosphorCrown,
  PhosphorUser,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { OrganizationMember, OrganizationWithRole, MemberRole } from "@/lib/organizations/types";
import {
  OrganizationInvitation,
  InvitationRole,
} from "@/lib/invitations/types";
import {
  createInvitationAction,
  getOrganizationInvitationsAction,
  revokeInvitationAction,
  resendInvitationAction,
  removeMemberAction,
} from "@/lib/invitations/actions";
import {
  TeamRecord,
  MemberDetailRecord,
  getTeamsWithDetailsAction,
  createTeamAction,
  updateTeamAction,
  deleteTeamAction,
  assignMemberToTeamAction,
  removeMemberFromTeamAction,
  updateTeamPermissionsAction,
  getMemberDetailsAction,
  setMemberPermissionOverrideAction,
  applyTeamTemplatesAction,
} from "@/lib/permissions/actions";
import {
  PERMISSION_CATEGORIES,
  PERMISSIONS_REGISTRY,
  PermissionCategory,
  PermissionDefinition,
} from "@/lib/permissions/registry";
import { SUGGESTED_TEAM_TEMPLATES } from "@/lib/organizations/catalog";
import { useSettings } from "@/components/dashboard/settings/settings-context";

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
  zinc: { bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20" },
};

interface PeopleHubProps {
  activeOrg: OrganizationWithRole | null;
  currentUserId?: string;
  initialMembers: OrganizationMember[];
  initialInvitations?: OrganizationInvitation[];
  currentUserRole?: MemberRole;
  isOwner?: boolean;
  userPermissions?: string[];
}

export function PeopleHub({
  activeOrg,
  currentUserId,
  initialMembers,
  initialInvitations = [],
  currentUserRole = "owner",
  isOwner = false,
  userPermissions = [],
}: PeopleHubProps) {
  const { openSettings } = useSettings();
  const [activeTab, setActiveTab] = React.useState<"members" | "teams" | "permissions" | "invitations">("members");

  // Members state
  const [members, setMembers] = React.useState<OrganizationMember[]>(initialMembers);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [teamFilter, setTeamFilter] = React.useState<string>("all");

  // Invitations state
  const [invitations, setInvitations] = React.useState<OrganizationInvitation[]>(initialInvitations);
  const [isLoadingInvitations, setIsLoadingInvitations] = React.useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteTeamId, setInviteTeamId] = React.useState("");
  const [isSendingInvite, setIsSendingInvite] = React.useState(false);
  const [createdInviteLink, setCreatedInviteLink] = React.useState<string | null>(null);
  const [inviteEmailSent, setInviteEmailSent] = React.useState<boolean | null>(null);
  const [inviteEmailError, setInviteEmailError] = React.useState<string | null>(null);
  const [invitedTargetEmail, setInvitedTargetEmail] = React.useState<string>("");
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [copiedToken, setCopiedToken] = React.useState(false);

  // Team Templates state
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = React.useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = React.useState<string[]>(
    SUGGESTED_TEAM_TEMPLATES.map((t) => t.id)
  );
  const [isApplyingTemplates, setIsApplyingTemplates] = React.useState(false);
  const [templateApplyResult, setTemplateApplyResult] = React.useState<{ created: number; skipped: number } | null>(null);

  // Member Governance (remove) state
  const [isMutatingMember, setIsMutatingMember] = React.useState(false);

  // Permissions & Governance
  const userPermSet = React.useMemo(() => new Set(userPermissions), [userPermissions]);
  const hasRootAccess = isOwner || currentUserRole === "owner" || activeOrg?.role === "owner";
  const canInvite = hasRootAccess || userPermSet.has("people.invite");
  const canRemove = hasRootAccess || userPermSet.has("people.remove");
  const canManageOverrides = hasRootAccess || userPermSet.has("people.manage_permissions");
  const canCreateTeams = hasRootAccess || userPermSet.has("teams.create");
  const canDeleteTeams = hasRootAccess || userPermSet.has("teams.delete");
  const canManageTeamPerms = hasRootAccess || userPermSet.has("teams.manage_permissions");
  const canManageTeamMembers = hasRootAccess || userPermSet.has("teams.manage_members");

  const loadInvitations = React.useCallback(async () => {
    if (!activeOrg) return;
    setIsLoadingInvitations(true);
    try {
      const res = await getOrganizationInvitationsAction(activeOrg.id);
      if (res.success && res.invitations) {
        setInvitations(res.invitations);
      }
    } finally {
      setIsLoadingInvitations(false);
    }
  }, [activeOrg]);

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeOrg) return;
    if (teams.length > 0 && !inviteTeamId) {
      setInviteError("Please select a team for the member.");
      return;
    }
    const targetEmail = inviteEmail.trim();
    setIsSendingInvite(true);
    setInviteError(null);
    setCreatedInviteLink(null);
    setInviteEmailSent(null);
    setInviteEmailError(null);
    setInvitedTargetEmail(targetEmail);
    try {
      const res = await createInvitationAction({
        organizationId: activeOrg.id,
        email: targetEmail,
        role: "member",
        jobTitle: undefined,
        initialTeamIds: inviteTeamId ? [inviteTeamId] : undefined,
      });
      if (res.success) {
        setCreatedInviteLink(res.inviteLink || null);
        setInviteEmailSent(res.emailSent ?? false);
        setInviteEmailError(res.emailError || null);
        setInviteEmail("");
        setInviteTeamId("");
        await loadInvitations();
      } else {
        setInviteError(res.error || "Failed to create invitation.");
      }
    } catch (err: any) {
      setInviteError(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleApplyTemplates = async () => {
    if (!activeOrg || selectedTemplateIds.length === 0) return;
    setIsApplyingTemplates(true);
    setTemplateApplyResult(null);
    try {
      const res = await applyTeamTemplatesAction({
        organizationId: activeOrg.id,
        templateIds: selectedTemplateIds,
      });
      if (res.success) {
        setTemplateApplyResult({ created: res.createdCount, skipped: res.skippedCount });
        await loadTeams();
      } else {
        alert(res.error || "Failed to apply templates.");
      }
    } catch (err: any) {
      alert(err?.message || "Error applying templates.");
    } finally {
      setIsApplyingTemplates(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!activeOrg) return;
    if (!confirm("Are you sure you want to revoke this invitation?")) return;
    const res = await revokeInvitationAction(invitationId);
    if (res.success) {
      await loadInvitations();
    } else {
      alert(res.error || "Failed to revoke invitation.");
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    const res = await resendInvitationAction(invitationId);
    if (res.success) {
      if (res.inviteLink) {
        navigator.clipboard?.writeText(res.inviteLink);
      }
      if (res.emailSent) {
        alert("Invitation email resent successfully! The link has also been copied to your clipboard.");
      } else {
        alert(`Invitation refreshed. Note: email delivery was not sent (${res.emailError || "Email provider not configured"}).\n\nNew link copied to clipboard:\n${res.inviteLink}`);
      }
      await loadInvitations();
    } else {
      alert(res.error || "Failed to resend invitation.");
    }
  };

  const handleRemoveMember = async (targetUserId: string, memberName: string) => {
    if (!activeOrg) return;
    if (!confirm(`Are you sure you want to remove ${memberName} from this workspace?`)) return;
    setIsMutatingMember(true);
    try {
      const res = await removeMemberAction({
        organizationId: activeOrg.id,
        targetUserId,
      });
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.user_id !== targetUserId && m.id !== targetUserId));
        setSelectedMember(null);
        await loadTeams();
      } else {
        alert(res.error || "Failed to remove member.");
      }
    } finally {
      setIsMutatingMember(false);
    }
  };

  // Teams state (fetched from backend)
  const [teams, setTeams] = React.useState<TeamRecord[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = React.useState(true);

  // Selected member for detail drawer/modal
  const [selectedMember, setSelectedMember] = React.useState<MemberDetailRecord | null>(null);
  const [isLoadingMemberDetail, setIsLoadingMemberDetail] = React.useState(false);
  const [memberDetailTab, setMemberDetailTab] = React.useState<"teams" | "permissions">("teams");

  // Editing Team modal / drawer
  const [editingTeam, setEditingTeam] = React.useState<TeamRecord | null>(null);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = React.useState(false);
  const [newTeamName, setNewTeamName] = React.useState("");
  const [newTeamDesc, setNewTeamDesc] = React.useState("");
  const [newTeamColor, setNewTeamColor] = React.useState("blue");

  // Team permissions editing modal
  const [managingPermissionsTeam, setManagingPermissionsTeam] = React.useState<TeamRecord | null>(null);
  const [selectedTeamPerms, setSelectedTeamPerms] = React.useState<Set<string>>(new Set());
  const [isSavingTeamPerms, setIsSavingTeamPerms] = React.useState(false);

  // Load teams on mount
  const loadTeams = React.useCallback(async () => {
    setIsLoadingTeams(true);
    const res = await getTeamsWithDetailsAction(activeOrg?.id);
    if (res.success) {
      setTeams(res.teams);
    }
    setIsLoadingTeams(false);
  }, [activeOrg?.id]);

  React.useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  // Handle open member detail
  const handleOpenMemberDetail = async (userId: string, targetTab?: "teams" | "permissions") => {
    setIsLoadingMemberDetail(true);
    const res = await getMemberDetailsAction(userId);
    if (res.success && res.member) {
      setSelectedMember(res.member);
      if (targetTab) {
        setMemberDetailTab(targetTab);
      } else if (!selectedMember || selectedMember.user_id !== userId) {
        setMemberDetailTab("teams");
      }
    }
    setIsLoadingMemberDetail(false);
  };

  // Toggle Team membership for selected member
  const handleToggleMemberTeam = async (teamId: string, isAssigned: boolean) => {
    if (!selectedMember) return;
    if (!canManageTeamMembers) {
      alert("Forbidden: You do not have permission to manage team members.");
      return;
    }
    if (isAssigned) {
      await removeMemberFromTeamAction({ teamId, userId: selectedMember.user_id });
    } else {
      await assignMemberToTeamAction({ teamId, userId: selectedMember.user_id });
    }
    // Refresh member details and teams list
    await Promise.all([handleOpenMemberDetail(selectedMember.user_id, memberDetailTab), loadTeams()]);
  };

  // Error states for operations
  const [createTeamError, setCreateTeamError] = React.useState<string | null>(null);
  const [teamPermsError, setTeamPermsError] = React.useState<string | null>(null);
  const [overrideError, setOverrideError] = React.useState<string | null>(null);

  // Toggle explicit permission override
  const handleSetOverride = async (permissionKey: string, effect: "allow" | "deny" | "inherit") => {
    if (!selectedMember || selectedMember.isOwner) return;
    if (!canManageOverrides) {
      setOverrideError("Forbidden: You do not have permission to manage individual overrides.");
      return;
    }
    setOverrideError(null);
    const res = await setMemberPermissionOverrideAction({
      targetUserId: selectedMember.user_id,
      permissionKey,
      effect,
    });
    if (res.success) {
      await handleOpenMemberDetail(selectedMember.user_id);
    } else {
      setOverrideError(res.error || "Failed to update override.");
    }
  };

  // Create Team submit
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setCreateTeamError(null);
    const res = await createTeamAction({
      name: newTeamName,
      description: newTeamDesc,
      color: newTeamColor,
    });
    if (res.success) {
      setNewTeamName("");
      setNewTeamDesc("");
      setNewTeamColor("blue");
      setIsCreateTeamOpen(false);
      await loadTeams();
    } else {
      setCreateTeamError(res.error || "Failed to create team.");
    }
  };

  // Delete team
  const handleDeleteTeam = async (teamId: string) => {
    if (!canDeleteTeams) {
      alert("Forbidden: You do not have permission to delete teams.");
      return;
    }
    if (!confirm("Are you sure you want to delete this team? Members will lose inherited permissions.")) return;
    const res = await deleteTeamAction(teamId);
    if (res.success) {
      await loadTeams();
    } else {
      alert(res.error || "Failed to delete team.");
    }
  };

  // Open team permissions editor
  const handleOpenTeamPermissions = (team: TeamRecord) => {
    setManagingPermissionsTeam(team);
    setSelectedTeamPerms(new Set(team.permissions || []));
    setTeamPermsError(null);
  };

  // Save team permissions
  const handleSaveTeamPermissions = async () => {
    if (!managingPermissionsTeam) return;
    if (!canManageTeamPerms) {
      setTeamPermsError("Forbidden: You do not have permission to edit team permissions.");
      return;
    }
    setIsSavingTeamPerms(true);
    setTeamPermsError(null);
    const res = await updateTeamPermissionsAction({
      teamId: managingPermissionsTeam.id,
      permissionKeys: Array.from(selectedTeamPerms),
    });
    if (res.success) {
      setManagingPermissionsTeam(null);
      await loadTeams();
    } else {
      setTeamPermsError(res.error || "Failed to update team permissions.");
    }
    setIsSavingTeamPerms(false);
  };

  // Filtered members list
  const filteredMembers = members.filter((m) => {
    const memId = m.user_id || m.id;
    const name = (m.profile?.full_name || m.profile?.email || "").toLowerCase();
    const memberTeamNames = teams
      .filter((t) => t.member_user_ids?.includes(memId))
      .map((t) => t.name.toLowerCase())
      .join(" ");
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === "" || name.includes(q) || memberTeamNames.includes(q);
    const matchesTeam =
      teamFilter === "all" ||
      teams.some((t) => t.id === teamFilter && t.member_user_ids?.includes(memId));
    return matchesSearch && matchesTeam;
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <PhosphorUsers className="h-6 w-6 text-blue-500" />
            <span>People & Teams</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage your company roster, define custom teams, and configure granular permissions.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-colors",
              activeTab === "members"
                ? "bg-zinc-800 text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <PhosphorUsers className="h-3.5 w-3.5" />
            <span>People</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-700/60 text-zinc-300">
              {members.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("teams")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-colors",
              activeTab === "teams"
                ? "bg-zinc-800 text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <PhosphorUserList className="h-3.5 w-3.5" />
            <span>Teams</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-700/60 text-zinc-300">
              {teams.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("permissions")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-colors",
              activeTab === "permissions"
                ? "bg-zinc-800 text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <PhosphorUserGear className="h-3.5 w-3.5" />
            <span>Capabilities</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("invitations")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-colors",
              activeTab === "invitations"
                ? "bg-zinc-800 text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <PhosphorUserPlus className="h-3.5 w-3.5" />
            <span>Invitations</span>
            {invitations.filter((i) => i.status === "pending").length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold">
                {invitations.filter((i) => i.status === "pending").length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: MEMBERS */}
      {activeTab === "members" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Filter by name, email, or team..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-zinc-800 bg-zinc-900 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="text-xs rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">All Teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {canInvite && (
                <button
                  type="button"
                  onClick={() => {
                    setInviteEmail("");
                    setInviteTeamId("");
                    setInviteError(null);
                    setCreatedInviteLink(null);
                    setInviteEmailSent(null);
                    setInviteEmailError(null);
                    setInvitedTargetEmail("");
                    setCopiedToken(false);
                    setIsInviteModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors shadow-xs cursor-pointer"
                >
                  <PhosphorUserPlus className="h-3.5 w-3.5" />
                  <span>Invite Member</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => openSettings("permissions")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5 text-zinc-400" />
                <span>Permissions Setup</span>
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-800/40 text-zinc-400 font-medium">
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Teams</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-zinc-500">
                        No members found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => {
                      const memId = member.user_id || member.id;
                      const isOwner = member.role === "owner";
                      const memberTeams = teams.filter((t) => t.member_user_ids?.includes(memId));

                      const hasEmail = Boolean(member.profile?.email);
                      const hasName = Boolean(member.profile?.full_name?.trim());

                      const displayName = hasName
                        ? member.profile!.full_name!.trim()
                        : hasEmail
                        ? member.profile!.email.split("@")[0]
                        : `Unlinked Member (${memId.slice(0, 8)})`;

                      const displayEmail = hasEmail ? member.profile!.email : null;

                      return (
                        <tr
                          key={member.id}
                          className="hover:bg-zinc-800/30 transition-colors cursor-pointer"
                          onClick={() => handleOpenMemberDetail(memId)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {member.profile?.avatar_url ? (
                                <img
                                  src={member.profile.avatar_url}
                                  alt={displayName}
                                  className="h-7 w-7 rounded-full object-cover shrink-0"
                                />
                              ) : hasEmail || hasName ? (
                                <div className="h-7 w-7 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                  {displayName.charAt(0)}
                                </div>
                              ) : (
                                <div
                                  className="h-7 w-7 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center justify-center shrink-0"
                                  title="Profile not linked in database"
                                >
                                  <PhosphorUser className="h-3.5 w-3.5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-medium text-white truncate">{displayName}</span>
                                  {isOwner && (
                                    <span
                                      title="Dono da empresa"
                                      className="inline-flex items-center text-amber-400 shrink-0 cursor-default"
                                    >
                                      <PhosphorCrown
                                        className="h-3.5 w-3.5 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.2)]"
                                        aria-hidden="true"
                                      />
                                      <span className="sr-only">Dono da empresa</span>
                                    </span>
                                  )}
                                </div>
                                {displayEmail ? (
                                  <span className="text-[11px] text-zinc-500 font-mono block truncate">
                                    {displayEmail}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-amber-400/80 font-mono flex items-center gap-1 truncate italic">
                                    <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                                    Unlinked profile record
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {memberTeams.length === 0 ? (
                                <span className="text-[11px] text-zinc-600 italic">No teams</span>
                              ) : (
                                memberTeams.map((team) => {
                                  const c = COLOR_MAP[team.color] || COLOR_MAP.blue;
                                  return (
                                    <span
                                      key={team.id}
                                      className={cn(
                                        "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border",
                                        c.bg,
                                        c.text,
                                        c.border
                                      )}
                                    >
                                      {team.name}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-zinc-500 font-mono text-[11px]">
                            {new Date(member.created_at).toLocaleDateString()}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMemberDetail(memId);
                              }}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                            >
                              View / Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEAMS */}
      {activeTab === "teams" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Custom Workspace Teams</h2>
              <p className="text-xs text-zinc-400">
                Teams define functional groups and inherited capabilities (Discord-style model).
              </p>
            </div>

            <div className="flex items-center gap-2">
              {canCreateTeams && (
                <button
                  type="button"
                  onClick={() => {
                    setTemplateApplyResult(null);
                    setIsTemplatesModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>Team Templates</span>
                </button>
              )}

              {canCreateTeams && (
                <button
                  type="button"
                  onClick={() => setIsCreateTeamOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Team</span>
                </button>
              )}
            </div>
          </div>

          {isLoadingTeams ? (
            <div className="py-12 text-center text-zinc-500 text-xs">Loading teams...</div>
          ) : teams.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-3.5 max-w-lg mx-auto">
              <FolderGit2 className="h-8 w-8 text-zinc-600 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-white">No teams created yet</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Create custom functional squads or import standard enterprise teams (Engineering, Product, Design, etc.) to organize members and bundle permissions.
                </p>
              </div>
              {canCreateTeams && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateApplyResult(null);
                      setIsTemplatesModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>Import Standard Teams</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateTeamOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Custom Team</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {teams.map((team) => {
                const c = COLOR_MAP[team.color] || COLOR_MAP.blue;
                const membersAssigned = members.filter((m) =>
                  team.member_user_ids?.includes(m.user_id || m.id)
                );

                return (
                  <div
                    key={team.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3.5 hover:border-zinc-700 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "h-7 w-7 rounded-lg flex items-center justify-center font-bold text-xs uppercase border shrink-0",
                              c.bg,
                              c.text,
                              c.border
                            )}
                          >
                            {team.name.charAt(0)}
                          </span>
                          <div>
                            <h3 className="text-sm font-semibold text-white">{team.name}</h3>
                            <span className="text-[11px] text-zinc-400">
                              {membersAssigned.length}{" "}
                              {membersAssigned.length === 1 ? "member" : "members"}
                            </span>
                          </div>
                        </div>

                        {canDeleteTeams && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTeam(team.id)}
                            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                            title="Delete team"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed min-h-[32px]">
                        {team.description || "Custom workspace team."}
                      </p>
                    </div>

                    {/* Permissions preview */}
                    <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 font-medium">Team Permissions</span>
                        <button
                          type="button"
                          onClick={() => handleOpenTeamPermissions(team)}
                          className="text-blue-400 hover:underline font-semibold text-[10px]"
                        >
                          {canManageTeamPerms ? "Manage" : "View"} ({team.permissions?.length || 0})
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {(team.permissions || []).length === 0 ? (
                          <span className="text-[10px] text-zinc-500 italic">No permissions assigned yet</span>
                        ) : (
                          (team.permissions || []).slice(0, 4).map((pKey) => (
                            <span
                              key={pKey}
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700/60"
                            >
                              {pKey}
                            </span>
                          ))
                        )}
                        {(team.permissions || []).length > 4 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-800 text-zinc-400">
                            +{(team.permissions?.length || 0) - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Team Members Roster */}
                    <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Members</span>
                        <span className="text-zinc-500">{membersAssigned.length}</span>
                      </div>

                      <div className="flex flex-wrap gap-1 min-h-[26px]">
                        {membersAssigned.length === 0 ? (
                          <span className="text-[10px] text-zinc-500 italic">No members assigned</span>
                        ) : (
                          membersAssigned.slice(0, 5).map((m) => (
                            <span
                              key={m.id}
                              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700"
                            >
                              {m.profile?.full_name?.split(" ")[0] || m.profile?.email?.split("@")[0]}
                            </span>
                          ))
                        )}
                        {membersAssigned.length > 5 && (
                          <span className="text-[10px] text-zinc-500 self-center">
                            +{membersAssigned.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CAPABILITIES MATRIX */}
      {activeTab === "permissions" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Permissions Registry & Discord Model</h2>
              <p className="text-xs text-zinc-400">
                Precedence: <strong>Owner</strong> &gt; <strong>Explicit Individual DENY</strong> &gt; <strong>Individual ALLOW</strong> &gt; <strong>Team ALLOW</strong> &gt; <strong>Default DENY</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openSettings("permissions")}
              className="px-3 py-1.5 text-xs font-medium rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white transition-colors"
            >
              Open Settings Matrix
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {PERMISSION_CATEGORIES.map((cat) => {
              const perms = PERMISSIONS_REGISTRY.filter((p) => p.category === cat.id);
              return (
                <div key={cat.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                    <ShieldCheck className="h-4 w-4 text-blue-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">{cat.label}</h3>
                  </div>
                  <div className="space-y-2">
                    {perms.map((p) => (
                      <div key={p.key} className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <span className="font-semibold text-zinc-200 block">{p.name}</span>
                          <span className="text-[11px] text-zinc-400 block leading-tight">{p.description}</span>
                        </div>
                        <code className="text-[10px] font-mono text-zinc-500 shrink-0 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                          {p.key}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: INVITATIONS */}
      {activeTab === "invitations" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white">Workspace Invitations</h2>
              <p className="text-xs text-zinc-400">
                Invitations are single-use, cryptographically secure, and expire after 7 days.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadInvitations}
                disabled={isLoadingInvitations}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <PhosphorArrowsClockwise className={cn("h-3.5 w-3.5 text-zinc-400", isLoadingInvitations && "animate-spin")} />
                <span>Refresh</span>
              </button>
              {canInvite && (
                <button
                  type="button"
                  onClick={() => {
                    setInviteEmail("");
                    setInviteTeamId("");
                    setInviteError(null);
                    setCreatedInviteLink(null);
                    setCopiedToken(false);
                    setIsInviteModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors shadow-xs cursor-pointer"
                >
                  <PhosphorUserPlus className="h-3.5 w-3.5" />
                  <span>Invite Member</span>
                </button>
              )}
            </div>
          </div>

          {/* Invitations Table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-800/40 text-zinc-400 font-medium">
                    <th className="py-3 px-4">Invited Email</th>
                    <th className="py-3 px-4">Assigned Team</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Invited By</th>
                    <th className="py-3 px-4">Expires / Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {invitations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500">
                        No invitations found. Use the &quot;Invite Member&quot; button to send an invite.
                      </td>
                    </tr>
                  ) : (
                    invitations.map((inv) => {
                      const isPending = inv.status === "pending";
                      const isExpired = inv.status === "expired" || (isPending && new Date(inv.expires_at) < new Date());
                      const effectiveStatus = isExpired && isPending ? "expired" : inv.status;

                      return (
                        <tr key={inv.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-zinc-400 shrink-0" />
                              <span className="font-mono text-white">{inv.email}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {inv.initial_team_ids && inv.initial_team_ids.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {inv.initial_team_ids.map((tid) => {
                                    const t = teams.find((item) => item.id === tid);
                                    if (!t) return null;
                                    const c = COLOR_MAP[t.color] || COLOR_MAP.blue;
                                    return (
                                      <span
                                        key={tid}
                                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${c.bg} ${c.text} ${c.border}`}
                                      >
                                        {t.name}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-[11px] text-zinc-500 italic">No team</span>
                              )}
                              {inv.job_title && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 font-medium text-[10px] w-fit">
                                  <Briefcase className="h-2.5 w-2.5 text-zinc-500" />
                                  {inv.job_title}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize",
                                effectiveStatus === "pending"
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  : effectiveStatus === "accepted"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : effectiveStatus === "expired"
                                  ? "bg-zinc-800 text-zinc-500 border-zinc-700"
                                  : "bg-red-500/10 text-red-400 border-red-500/30"
                              )}
                            >
                              {effectiveStatus}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-zinc-400 text-[11px]">
                            {inv.invited_by_name || "Workspace Admin"}
                          </td>

                          <td className="px-4 py-3 text-zinc-500 font-mono text-[11px]">
                            {new Date(inv.expires_at).toLocaleDateString()}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {effectiveStatus === "pending" && canInvite && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleResendInvitation(inv.id)}
                                    className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                                    title="Resend and copy new invite link"
                                  >
                                    <PhosphorArrowsClockwise className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeInvitation(inv.id)}
                                    className="p-1 rounded-md text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                                    title="Revoke invitation"
                                  >
                                    <Ban className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                              {effectiveStatus === "expired" && canInvite && (
                                <button
                                  type="button"
                                  onClick={() => handleResendInvitation(inv.id)}
                                  className="text-[11px] px-2 py-1 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                                >
                                  Re-invite
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL: MEMBER DETAIL & PERMISSIONS OVERRIDES */}
      {selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-xs"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="w-full max-w-xl h-full bg-zinc-900 border-l border-zinc-800 p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              {/* Drawer Top Header */}
              <div className="flex items-start justify-between pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-base uppercase shrink-0">
                    {selectedMember.profile?.full_name?.charAt(0) || selectedMember.profile?.email?.charAt(0) || "M"}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <span className="truncate">{selectedMember.profile?.full_name || selectedMember.profile?.email?.split("@")[0] || "Member"}</span>
                      {selectedMember.isOwner && (
                        <span
                          title="Dono da empresa"
                          className="inline-flex items-center text-amber-400 shrink-0 cursor-default"
                        >
                          <PhosphorCrown
                            className="h-4 w-4 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.2)]"
                            aria-hidden="true"
                          />
                          <span className="sr-only">Dono da empresa</span>
                        </span>
                      )}
                    </h2>
                    <span className="text-xs text-zinc-400 font-mono block truncate">
                      {selectedMember.profile?.email || "No email"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMember(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0 ml-2 cursor-pointer"
                  aria-label="Fechar painel"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Tab switcher */}
              <div className="flex items-center gap-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                <button
                  type="button"
                  onClick={() => setMemberDetailTab("teams")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg font-medium transition-colors text-center cursor-pointer",
                    memberDetailTab === "teams"
                      ? "bg-zinc-800 text-white font-semibold shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  Assigned Teams ({selectedMember.teams.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMemberDetailTab("permissions")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg font-medium transition-colors text-center cursor-pointer",
                    memberDetailTab === "permissions"
                      ? "bg-zinc-800 text-white font-semibold shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  Granular Permissions
                </button>
              </div>

              {/* TAB 1: TEAMS ASSIGNMENT */}
              {memberDetailTab === "teams" && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400">
                    Select teams for this member. Permissions configured on each team are automatically inherited.
                  </p>

                  <div className="space-y-2">
                    {teams.length === 0 ? (
                      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/40 text-center text-xs text-zinc-500">
                        No teams exist yet. Create a team first to assign it to this member.
                      </div>
                    ) : (
                      teams.map((t) => {
                        const isAssigned = selectedMember.teams.some((st) => st.id === t.id);
                        const c = COLOR_MAP[t.color] || COLOR_MAP.blue;

                        return (
                          <div
                            key={t.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-xl border text-xs transition-colors",
                              isAssigned
                                ? "border-blue-500/40 bg-blue-500/10 text-white"
                                : "border-zinc-800 bg-zinc-950/60 text-zinc-400"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "h-6 w-6 rounded-md flex items-center justify-center font-bold text-[10px] uppercase border",
                                  c.bg,
                                  c.text,
                                  c.border
                                )}
                              >
                                {t.name.charAt(0)}
                              </span>
                              <div>
                                <span className="font-semibold block text-white">{t.name}</span>
                                <span className="text-[10px] text-zinc-500">
                                  {t.permissions?.length || 0} permissions assigned
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={!canManageTeamMembers}
                              onClick={() => handleToggleMemberTeam(t.id, isAssigned)}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer",
                                isAssigned
                                  ? "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30"
                                  : "bg-blue-600 hover:bg-blue-500 text-white border-transparent",
                                !canManageTeamMembers && "opacity-40 cursor-not-allowed hover:bg-transparent"
                              )}
                              title={
                                canManageTeamMembers
                                  ? isAssigned
                                    ? "Leave Team"
                                    : "Join Team"
                                  : "You do not have permission to manage team members"
                              }
                            >
                              {isAssigned ? "Leave Team" : "Join Team"}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: GRANULAR PERMISSIONS & OVERRIDES */}
              {memberDetailTab === "permissions" && (
                <div className="space-y-4">
                  {selectedMember.isOwner ? (
                    <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <PhosphorCrown className="h-4 w-4 text-amber-400 shrink-0" />
                        <p className="font-bold text-amber-300">Workspace Owner — Root Access</p>
                      </div>
                      <p className="text-[11px] text-amber-300/80 leading-relaxed">
                        The Owner has full root access across the workspace. All capabilities are permanently active and cannot be removed, restricted, or denied.
                      </p>
                    </div>
                  ) : (
                    <>
                      {overrideError && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                          <span>{overrideError}</span>
                        </div>
                      )}

                      {!canManageOverrides && (
                        <div className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 text-[11px] text-zinc-400">
                          View-only mode: only authorized members with permission to manage permissions can modify overrides.
                        </div>
                      )}

                      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 space-y-1">
                        <p className="font-medium text-white">Precedence Hierarchy:</p>
                        <p className="text-[11px]">
                          <strong>Explicit Deny</strong> &gt; <strong>Explicit Allow</strong> &gt; <strong>Inherited from Team</strong> &gt; <strong>Default Denied</strong>
                        </p>
                      </div>

                      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                        {PERMISSIONS_REGISTRY.map((perm) => {
                          const isExplicitAllow = selectedMember.explicitAllows.includes(perm.key);
                          const isExplicitDeny = selectedMember.explicitDenies.includes(perm.key);
                          const inheritedTeams = selectedMember.inheritedFromTeams[perm.key] || [];
                          const isInherited = inheritedTeams.length > 0;
                          const effectiveHas = selectedMember.effectivePermissions.includes(perm.key);

                          return (
                            <div
                              key={perm.key}
                              className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/50 flex items-start justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0">
                                <span className="font-semibold text-white block">{perm.name}</span>
                                <span className="text-[10px] text-zinc-400 block">{perm.description}</span>

                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                  {isExplicitDeny && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                                      Explicitly Denied
                                    </span>
                                  )}
                                  {isExplicitAllow && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                      Explicit Direct Grant
                                    </span>
                                  )}
                                  {isInherited && !isExplicitDeny && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      Inherited: {inheritedTeams.join(", ")}
                                    </span>
                                  )}
                                  {!effectiveHas && !isExplicitDeny && (
                                    <span className="text-[10px] text-zinc-600 italic">Not granted</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={!canManageOverrides}
                                  onClick={() => handleSetOverride(perm.key, "allow")}
                                  className={cn(
                                    "px-2 py-1 rounded text-[10px] font-medium border transition-colors cursor-pointer",
                                    isExplicitAllow
                                      ? "bg-blue-600 text-white border-blue-500"
                                      : "border-zinc-800 hover:bg-zinc-800 text-zinc-400",
                                    !canManageOverrides && "opacity-40 cursor-not-allowed hover:bg-transparent"
                                  )}
                                  title={canManageOverrides ? "Explicitly grant this permission" : "Permission management not permitted"}
                                >
                                  Allow
                                </button>
                                <button
                                  type="button"
                                  disabled={!canManageOverrides}
                                  onClick={() => handleSetOverride(perm.key, "deny")}
                                  className={cn(
                                    "px-2 py-1 rounded text-[10px] font-medium border transition-colors cursor-pointer",
                                    isExplicitDeny
                                      ? "bg-red-600 text-white border-red-500"
                                      : "border-zinc-800 hover:bg-zinc-800 text-zinc-400",
                                    !canManageOverrides && "opacity-40 cursor-not-allowed hover:bg-transparent"
                                  )}
                                  title={canManageOverrides ? "Explicitly deny/restrict this permission" : "Permission management not permitted"}
                                >
                                  Deny
                                </button>
                                {(isExplicitAllow || isExplicitDeny) && (
                                  <button
                                    type="button"
                                    disabled={!canManageOverrides}
                                    onClick={() => handleSetOverride(perm.key, "inherit")}
                                    className={cn(
                                      "px-1.5 py-1 rounded text-[10px] font-medium text-zinc-500 hover:text-zinc-300 cursor-pointer",
                                      !canManageOverrides && "opacity-40 cursor-not-allowed hover:text-zinc-500"
                                    )}
                                    title={canManageOverrides ? "Reset to team inheritance" : "Permission management not permitted"}
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
              {canRemove && !selectedMember.isOwner && selectedMember.user_id !== currentUserId ? (
                <button
                  type="button"
                  disabled={isMutatingMember}
                  onClick={() =>
                    handleRemoveMember(
                      selectedMember.user_id,
                      selectedMember.profile?.full_name || selectedMember.profile?.email || "this member"
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-300 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove Member</span>
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE TEAM */}
      {isCreateTeamOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setIsCreateTeamOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-100 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-5 w-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Create New Team</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateTeamOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              {createTeamError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{createTeamError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Team Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering, Growth, Leadership"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-700 bg-zinc-800/80 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Description</label>
                <textarea
                  rows={2}
                  placeholder="Team charter or responsibilities..."
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-700 bg-zinc-800/80 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Theme Color</label>
                <div className="flex items-center gap-2">
                  {Object.keys(COLOR_MAP).map((cKey) => {
                    const c = COLOR_MAP[cKey];
                    return (
                      <button
                        key={cKey}
                        type="button"
                        onClick={() => setNewTeamColor(cKey)}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-transform",
                          c.bg,
                          c.border,
                          newTeamColor === cKey ? "scale-110 border-white" : "border-transparent"
                        )}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateTeamOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TEAM PERMISSIONS EDITOR */}
      {managingPermissionsTeam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setManagingPermissionsTeam(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-100 shadow-2xl flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Team Permissions:</span>
                  <span className="text-blue-400">{managingPermissionsTeam.name}</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Select which capabilities members of this team inherit automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManagingPermissionsTeam(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {teamPermsError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2 my-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{teamPermsError}</span>
              </div>
            )}

            {!canManageTeamPerms && (
              <div className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 text-[11px] text-zinc-400 my-2">
                View-only mode: only authorized members with permission to manage permissions can alter team capabilities.
              </div>
            )}

            <div className="my-3 overflow-y-auto space-y-4 pr-1">
              {PERMISSION_CATEGORIES.map((cat) => {
                const perms = PERMISSIONS_REGISTRY.filter((p) => p.category === cat.id);
                return (
                  <div key={cat.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 space-y-2">
                    <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider pb-1 border-b border-zinc-850">
                      {cat.label}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {perms.map((p) => {
                        const isChecked = selectedTeamPerms.has(p.key);
                        return (
                          <label
                            key={p.key}
                            className={cn(
                              "flex items-start gap-2.5 p-2 rounded-lg border text-xs transition-colors",
                              isChecked
                                ? "border-blue-500/40 bg-blue-500/10 text-white"
                                : "border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700",
                              canManageTeamPerms ? "cursor-pointer" : "cursor-default opacity-70"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={!canManageTeamPerms}
                              onChange={(e) => {
                                if (!canManageTeamPerms) return;
                                const next = new Set(selectedTeamPerms);
                                if (e.target.checked) next.add(p.key);
                                else next.delete(p.key);
                                setSelectedTeamPerms(next);
                              }}
                              className="mt-0.5 rounded border-zinc-700 text-blue-600 focus:ring-0 disabled:opacity-50"
                            />
                            <div className="min-w-0">
                              <span className="font-semibold block text-white">{p.name}</span>
                              <span className="text-[10px] text-zinc-400 block leading-tight">{p.description}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                {selectedTeamPerms.size} {selectedTeamPerms.size === 1 ? "permission" : "permissions"} selected
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setManagingPermissionsTeam(null)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canManageTeamPerms || isSavingTeamPerms}
                  onClick={handleSaveTeamPermissions}
                  className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSavingTeamPerms ? "Saving..." : canManageTeamPerms ? "Save Permissions" : "View Only"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INVITE MEMBER */}
      {isInviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setIsInviteModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-100 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhosphorUserPlus className="h-5 w-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Invite New Member</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {createdInviteLink ? (
              <div className="space-y-4 py-2">
                {inviteEmailSent ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Invitation email dispatched!</span>
                      <span>
                        An email invitation was successfully sent to <strong className="text-white">{invitedTargetEmail}</strong>. You can also copy the direct single-use link below.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Invitation created (Email delivery skipped)</span>
                      <span>
                        {inviteEmailError || "The email provider is not configured. Please share the invitation link below directly with your team member."}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Invite Link</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdInviteLink}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-200 select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(createdInviteLink);
                        setCopiedToken(true);
                        setTimeout(() => setCopiedToken(false), 2000);
                      }}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                    >
                      {copiedToken ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span>{copiedToken ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteModalOpen(false);
                      setCreatedInviteLink(null);
                      setInviteEmailSent(null);
                      setInviteEmailError(null);
                      setInvitedTargetEmail("");
                    }}
                    className="px-4 py-1.5 text-xs font-semibold rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvitation} className="space-y-4">
                {inviteError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>{inviteError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-700 bg-zinc-800/80 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Team *</label>
                  {teams.length === 0 ? (
                    <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 text-xs text-zinc-400">
                      No teams exist yet. Please create a team in the Teams tab first.
                    </div>
                  ) : (
                    <select
                      value={inviteTeamId}
                      onChange={(e) => setInviteTeamId(e.target.value)}
                      required
                      className="w-full text-xs rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="" disabled>Select a team...</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[11px] text-zinc-500">
                    The invited member will automatically join this team and inherit its configured permissions.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                  <p>• Single-use cryptographically secure invitation token.</p>
                  <p>• Automatically expires in 7 days if unaccepted.</p>
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteModalOpen(false);
                      setInviteTeamId("");
                    }}
                    className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingInvite || !inviteEmail.trim() || (teams.length > 0 && !inviteTeamId)}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSendingInvite ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Send Invitation</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: TEAM TEMPLATES */}
      {isTemplatesModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setIsTemplatesModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-100 shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Standard Team Templates</h3>
                  <p className="text-xs text-zinc-400">
                    Quickly bootstrap functional departments. Existing teams with identical names are automatically skipped.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTemplatesModalOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {templateApplyResult ? (
              <div className="space-y-4 py-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                  <div>
                    <span className="font-bold text-sm block">Team templates processed!</span>
                    <p className="mt-1 text-zinc-300">
                      Created <strong>{templateApplyResult.created}</strong> new team(s).
                      {templateApplyResult.skipped > 0 && (
                        <span> Skipped <strong>{templateApplyResult.skipped}</strong> team(s) that already existed.</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTemplatesModalOpen(false);
                      setTemplateApplyResult(null);
                    }}
                    className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Select the teams you would like to create:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateIds(SUGGESTED_TEAM_TEMPLATES.map((t) => t.id))}
                      className="text-blue-400 hover:underline cursor-pointer"
                    >
                      Select all
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateIds([])}
                      className="text-zinc-400 hover:underline cursor-pointer"
                    >
                      Clear all
                    </button>
                  </div>
                </div>

                <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
                  {SUGGESTED_TEAM_TEMPLATES.map((template) => {
                    const isSelected = selectedTemplateIds.includes(template.id);
                    const alreadyExists = teams.some(
                      (t) => t.name.trim().toLowerCase() === template.name.trim().toLowerCase()
                    );
                    const c = COLOR_MAP[template.color] || COLOR_MAP.blue;

                    return (
                      <div
                        key={template.id}
                        onClick={() => {
                          if (alreadyExists) return;
                          setSelectedTemplateIds((prev) =>
                            isSelected ? prev.filter((id) => id !== template.id) : [...prev, template.id]
                          );
                        }}
                        className={cn(
                          "p-3 rounded-xl border transition-all text-xs flex items-start gap-3",
                          alreadyExists
                            ? "opacity-60 bg-zinc-950/40 border-zinc-800/60 cursor-not-allowed"
                            : isSelected
                            ? "bg-zinc-800/80 border-blue-500/50 cursor-pointer"
                            : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 cursor-pointer"
                        )}
                      >
                        <input
                          type="checkbox"
                          readOnly
                          checked={isSelected && !alreadyExists}
                          disabled={alreadyExists}
                          className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 pointer-events-none"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{template.name}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${c.bg} ${c.text} ${c.border}`}>
                                {template.roles.length} roles
                              </span>
                            </div>
                            {alreadyExists && (
                              <span className="text-[10px] text-zinc-500 font-mono bg-zinc-800 px-2 py-0.5 rounded">
                                Already exists
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400">{template.description}</p>
                          <div className="pt-1 flex flex-wrap gap-1">
                            {template.roles.slice(0, 4).map((role) => (
                              <span
                                key={role}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800/60 text-zinc-400 border border-zinc-700/40"
                              >
                                {role}
                              </span>
                            ))}
                            {template.roles.length > 4 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] text-zinc-500">
                                +{template.roles.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    {selectedTemplateIds.length} team template(s) selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsTemplatesModalOpen(false)}
                      className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isApplyingTemplates || selectedTemplateIds.length === 0}
                      onClick={handleApplyTemplates}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      {isApplyingTemplates ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Applying...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                          <span>Apply Templates</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
