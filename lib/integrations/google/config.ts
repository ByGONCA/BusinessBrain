export const GOOGLE_SCOPES = {
  EMAIL: "https://www.googleapis.com/auth/userinfo.email",
  PROFILE: "https://www.googleapis.com/auth/userinfo.profile",
  GMAIL_READONLY: "https://www.googleapis.com/auth/gmail.readonly",
  CALENDAR_READONLY: "https://www.googleapis.com/auth/calendar.readonly",
  CALENDAR_EVENTS_READONLY: "https://www.googleapis.com/auth/calendar.events.readonly",
  CALENDAR_EVENTS: "https://www.googleapis.com/auth/calendar.events",
  DRIVE_READONLY: "https://www.googleapis.com/auth/drive.readonly",
  DRIVE_METADATA_READONLY: "https://www.googleapis.com/auth/drive.metadata.readonly",
} as const;

export const GMAIL_INTEGRATION_SCOPES: string[] = [
  GOOGLE_SCOPES.EMAIL,
  GOOGLE_SCOPES.PROFILE,
  GOOGLE_SCOPES.GMAIL_READONLY,
];

export const CALENDAR_INTEGRATION_SCOPES: string[] = [
  GOOGLE_SCOPES.EMAIL,
  GOOGLE_SCOPES.PROFILE,
  GOOGLE_SCOPES.CALENDAR_READONLY,
  GOOGLE_SCOPES.CALENDAR_EVENTS,
];

export const DRIVE_INTEGRATION_SCOPES: string[] = [
  GOOGLE_SCOPES.EMAIL,
  GOOGLE_SCOPES.PROFILE,
  GOOGLE_SCOPES.DRIVE_READONLY,
];

export const DEFAULT_GOOGLE_INTEGRATION_SCOPES: string[] = [
  GOOGLE_SCOPES.EMAIL,
  GOOGLE_SCOPES.PROFILE,
  GOOGLE_SCOPES.GMAIL_READONLY,
  GOOGLE_SCOPES.CALENDAR_READONLY,
  GOOGLE_SCOPES.CALENDAR_EVENTS,
  GOOGLE_SCOPES.DRIVE_READONLY,
];

export function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/google/callback`;

  return {
    clientId,
    clientSecret,
    redirectUri,
    isConfigured: !!(clientId && clientSecret),
  };
}

export function isGoogleIntegrationConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
