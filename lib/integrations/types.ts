export type IntegrationProvider =
  | "gmail"
  | "google_calendar"
  | "github"
  | "outlook"
  | "outlook_calendar"
  | "stripe"
  | "shopify"
  | "vercel"
  | "sentry"
  | "linear"
  | "google"
  | "microsoft"
  | "slack";

export type IntegrationStatus = "connected" | "disconnected" | "error" | "needs_reauth";

export type IntegrationCategory =
  | "all"
  | "communication"
  | "calendar"
  | "engineering"
  | "commerce"
  | "operations";

export interface IntegrationCatalogItem {
  id: IntegrationProvider;
  name: string;
  category: IntegrationCategory;
  descriptionKey: string;
  authType: "oauth2" | "api_key" | "webhook";
  envVars: string[];
  docsUrl?: string;
}

export interface OrganizationIntegration {
  id: string;
  organizationId: string;
  provider: IntegrationProvider;
  providerAccountId: string;
  accountEmail?: string;
  connectedByUserId?: string;
  status: IntegrationStatus;
  scopes: string[];
  tokenExpiresAt?: string;
  metadata: Record<string, unknown>;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  unread?: boolean;
}

export interface GoogleCalendarSummary {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  timeZone?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink?: string;
  status?: string;
}
