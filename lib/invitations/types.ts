export type InvitationRole = "admin" | "member";
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  job_title?: string;
  initial_team_ids?: string[];
  token?: string;
  invited_by: string | null;
  invited_by_name?: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  organization_name?: string;
}

export interface CreateInvitationResult {
  success: boolean;
  invitation?: OrganizationInvitation;
  inviteLink?: string;
  emailSent?: boolean;
  emailError?: string;
  error?: string;
}

export interface ResendInvitationResult {
  success: boolean;
  inviteLink?: string;
  emailSent?: boolean;
  emailError?: string;
  error?: string;
}

export interface AcceptInvitationResult {
  success: boolean;
  organizationId?: string;
  organizationName?: string;
  error?: string;
}

export interface PendingUserInvitation {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  email: string;
  role: InvitationRole;
  expiresAt: string;
  createdAt: string;
}

export interface InvitationPreview {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  invitedEmail: string;
  role: string;
  status: string;
  expiresAt: string;
  isExpired: boolean;
  emailMatchesUser: boolean;
  currentUserEmail?: string;
  rawToken: string;
}
