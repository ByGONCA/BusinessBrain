export const MICROSOFT_SCOPES = {
  USER_READ: "User.Read",
  CALENDARS_READWRITE: "Calendars.ReadWrite",
  CALENDARS_READ: "Calendars.Read",
  MAIL_READ: "Mail.Read",
  OFFLINE_ACCESS: "offline_access",
} as const;

export const OUTLOOK_CALENDAR_SCOPES: string[] = [
  MICROSOFT_SCOPES.USER_READ,
  MICROSOFT_SCOPES.CALENDARS_READWRITE,
  MICROSOFT_SCOPES.OFFLINE_ACCESS,
];

export const OUTLOOK_MAIL_SCOPES: string[] = [
  MICROSOFT_SCOPES.USER_READ,
  MICROSOFT_SCOPES.MAIL_READ,
  MICROSOFT_SCOPES.OFFLINE_ACCESS,
];

export const DEFAULT_MICROSOFT_SCOPES: string[] = [
  MICROSOFT_SCOPES.USER_READ,
  MICROSOFT_SCOPES.CALENDARS_READWRITE,
  MICROSOFT_SCOPES.MAIL_READ,
  MICROSOFT_SCOPES.OFFLINE_ACCESS,
];

export function getMicrosoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID || "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || "";
  const tenantId = process.env.MICROSOFT_TENANT_ID || "common";
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/microsoft/callback`;

  return {
    clientId,
    clientSecret,
    tenantId,
    redirectUri,
    isConfigured: !!(clientId && clientSecret),
  };
}

export function isMicrosoftIntegrationConfigured(): boolean {
  return !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}
