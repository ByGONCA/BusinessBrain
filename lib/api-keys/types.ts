// ==============================================================================
// Company Brain: Enterprise Public API Key Types
// ==============================================================================

export type ApiKeyScope =
  | "admin"
  | "read:projects"
  | "write:projects"
  | "read:documents"
  | "write:documents"
  | "read:metrics"
  | "read:integrations"
  | "read:discussions";

export interface OrganizationApiKey {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  rateLimitPerMinute: number;
  createdByUserId?: string;
  expiresAt?: string;
  revokedAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiKeyResult {
  apiKey: OrganizationApiKey;
  secretKey: string; // ONLY returned once
}

export interface ApiKeyAuthContext {
  keyId: string;
  organizationId: string;
  organizationName: string;
  scopes: ApiKeyScope[];
  rateLimitPerMinute: number;
}
