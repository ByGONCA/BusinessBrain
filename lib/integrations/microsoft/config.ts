import { getOAuthCallbackUrl } from "@/lib/security/redirects";

export const MICROSOFT_SCOPES = {
  USER_READ: "User.Read",
  CALENDARS_READWRITE: "Calendars.ReadWrite",
  CALENDARS_READ: "Calendars.Read",
  MAIL_READ: "Mail.Read",
  MAIL_READWRITE: "Mail.ReadWrite",
  MAIL_SEND: "Mail.Send",
  FILES_READ: "Files.Read",
  ONLINE_MEETINGS_READWRITE: "OnlineMeetings.ReadWrite",
  CHATS_READ: "Chat.Read",
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
  MICROSOFT_SCOPES.MAIL_READWRITE,
  MICROSOFT_SCOPES.MAIL_SEND,
  MICROSOFT_SCOPES.OFFLINE_ACCESS,
];

export const ONEDRIVE_SCOPES: string[] = [
  MICROSOFT_SCOPES.USER_READ,
  MICROSOFT_SCOPES.FILES_READ,
  MICROSOFT_SCOPES.OFFLINE_ACCESS,
];

export const TEAMS_SCOPES: string[] = [
  MICROSOFT_SCOPES.USER_READ,
  MICROSOFT_SCOPES.ONLINE_MEETINGS_READWRITE,
  MICROSOFT_SCOPES.OFFLINE_ACCESS,
];

export const DEFAULT_MICROSOFT_SCOPES: string[] = [
  MICROSOFT_SCOPES.USER_READ,
  MICROSOFT_SCOPES.CALENDARS_READWRITE,
  MICROSOFT_SCOPES.MAIL_READ,
  MICROSOFT_SCOPES.MAIL_READWRITE,
  MICROSOFT_SCOPES.MAIL_SEND,
  MICROSOFT_SCOPES.FILES_READ,
  MICROSOFT_SCOPES.ONLINE_MEETINGS_READWRITE,
  MICROSOFT_SCOPES.OFFLINE_ACCESS,
];

export function getMicrosoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID || "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || "";
  const tenantId = process.env.MICROSOFT_TENANT_ID || "common";
  const redirectUri = getOAuthCallbackUrl("microsoft");

  const isConfigured = Boolean(
    clientId &&
    clientSecret &&
    !clientId.includes("your-") &&
    !clientSecret.includes("your-")
  );

  return {
    clientId,
    clientSecret,
    tenantId,
    redirectUri,
    isConfigured,
  };
}

export function isMicrosoftIntegrationConfigured(): boolean {
  const id = process.env.MICROSOFT_CLIENT_ID;
  const secret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!id || !secret) return false;
  if (id.includes("your-") || secret.includes("your-")) return false;
  return true;
}
