// ==============================================================================
// Company Brain: AI Data Governance & Access Authorization Types
// ==============================================================================

export type AIScopeType = "once" | "conversation" | "persistent";

export type AIResourceType =
  | "area"
  | "page"
  | "document"
  | "finance"
  | "github"
  | "brain"
  | "tool";

export type AIActionType = "read" | "create" | "modify" | "execute";

export type AIAuthStatus = "active" | "revoked" | "expired";

export interface AIAccessAuthorization {
  id: string;
  organizationId: string;
  userId: string;
  grantedByUserId: string;
  scopeType: AIScopeType;
  conversationId?: string | null;
  resourceType: AIResourceType;
  resourceId: string;
  actionType: AIActionType;
  purpose: string;
  status: AIAuthStatus;
  expiresAt?: string | null;
  createdAt: string;
  revokedAt?: string | null;
  revokedByUserId?: string | null;
}

export interface AuthorizationChallenge {
  required: boolean;
  resourceType: AIResourceType;
  resourceId: string;
  title: string;
  reason: string;
  actionType: AIActionType;
  availableScopes: AIScopeType[];
}

export interface ContextSourceItem {
  id: string; // e.g. "area:finance", "area:pages", "page:<uuid>", "area:github"
  label: string;
  type: AIResourceType;
  category: "workspace_areas" | "pages" | "finance" | "external";
  description?: string;
  icon?: string;
  hasAccess: boolean; // Based on user's underlying permissions
  requiresExplicitGrant: boolean; // True for sensitive areas like finance
  updatedAt?: string;
}

export interface GrantAuthorizationParams {
  organizationId: string;
  userId: string;
  scopeType: AIScopeType;
  conversationId?: string | null;
  resourceType: AIResourceType;
  resourceId: string;
  actionType: AIActionType;
  purpose?: string;
  expiresInSeconds?: number;
}
