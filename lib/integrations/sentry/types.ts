// ==============================================================================
// KogSync: Sentry Integration Domain Types & Data Contracts
// ==============================================================================

export interface SentryOrganization {
  id: string;
  slug: string;
  name: string;
  dateCreated: string;
  status?: {
    id: string;
    name: string;
  };
  regionUrl?: string;
}

export interface SentryProject {
  id: string;
  slug: string;
  name: string;
  platform?: string;
  dateCreated: string;
  isBookmarked?: boolean;
  hasAccess?: boolean;
  color?: string;
  firstEvent?: string;
}

export interface SentryIssueTag {
  key: string;
  value: string;
}

export interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit?: string;
  permalink: string;
  logger?: string;
  level: "fatal" | "error" | "warning" | "info" | string;
  status: "unresolved" | "resolved" | "ignored" | string;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  project: {
    id: string;
    slug: string;
    name: string;
    platform?: string;
  };
  hasSeen?: boolean;
  isBookmarked?: boolean;
}

export interface SentryEventDetail {
  id: string;
  eventID: string;
  message?: string;
  title?: string;
  dateCreated: string;
  tags: SentryIssueTag[];
  platform?: string;
  context?: Record<string, unknown>;
  user?: {
    id?: string;
    email?: string;
    username?: string;
    ip_address?: string;
  };
  entries?: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
}

export interface SentryTokenExchangeResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string[] | string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface SentryAuthStatePayload {
  organizationId: string;
  userId: string;
  returnUrl?: string;
  nonce: string;
  timestamp: number;
}

export interface SentryIntegrationMetadata {
  sentry_org_id?: string;
  sentry_org_slug?: string;
  sentry_org_name?: string;
  region_url?: string;
  connected_user_id?: string;
  connected_user_email?: string;
  selected_project_slug?: string;
  last_synced_at?: string;
  refresh_lock_worker?: string;
  refresh_lock_until?: string;
}

export interface SentryWorkspaceSnapshot {
  status: "connected" | "disconnected" | "error" | "needs_reauth";
  connectedAccount?: {
    email?: string;
    organizationSlug?: string;
    organizationName?: string;
    connectedAt?: string;
  };
  projects: SentryProject[];
  recentIssues: SentryIssue[];
  selectedProjectSlug?: string;
  totalUnresolvedCount: number;
  lastSyncAt?: string;
}
