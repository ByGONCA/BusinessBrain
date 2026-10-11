export type InvitationRole = "admin" | "member";
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
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
  error?: string;
}

export interface AcceptInvitationResult {
  success: boolean;
  organizationId?: string;
  organizationName?: string;
  error?: string;
}
