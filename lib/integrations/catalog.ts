import { IntegrationCatalogItem, IntegrationProvider, IntegrationCategory } from "./types";

export interface IntegrationDefinition extends IntegrationCatalogItem {
  badge: string;
  website: string;
  logoUrl: string;
}

export const INTEGRATION_CATEGORIES: { id: IntegrationCategory; label: string }[] = [
  { id: "all", label: "All Integrations" },
  { id: "communication", label: "Email & Communication" },
  { id: "calendar", label: "Calendar & Meetings" },
  { id: "engineering", label: "Engineering & Code" },
  { id: "operations", label: "DevOps & Monitoring" },
  { id: "commerce", label: "Commerce & Billing" },
];

export const INTEGRATION_CATALOG: IntegrationDefinition[] = [
  {
    id: "gmail",
    name: "Gmail",
    category: "communication",
    descriptionKey: "gmail",
    authType: "oauth2",
    badge: "OAuth 2.0",
    website: "https://workspace.google.com/products/gmail/",
    logoUrl: "/Logos/google-gmail.svg",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    docsUrl: "https://developers.google.com/gmail/api",
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    category: "calendar",
    descriptionKey: "googleCalendar",
    authType: "oauth2",
    badge: "OAuth 2.0",
    website: "https://workspace.google.com/products/calendar/",
    logoUrl: "/Logos/google-calendar.svg",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    docsUrl: "https://developers.google.com/calendar",
  },
  {
    id: "google_drive",
    name: "Google Drive",
    category: "operations",
    descriptionKey: "googleDrive",
    authType: "oauth2",
    badge: "OAuth 2.0",
    website: "https://workspace.google.com/products/drive/",
    logoUrl: "/Logos/google-drive.svg",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    docsUrl: "https://developers.google.com/drive",
  },
  {
    id: "outlook",
    name: "Microsoft Outlook",
    category: "communication",
    descriptionKey: "outlook",
    authType: "oauth2",
    badge: "OAuth 2.0",
    website: "https://www.microsoft.com/microsoft-365/outlook",
    logoUrl: "/Logos/microsoft-icon.svg",
    envVars: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
    docsUrl: "https://learn.microsoft.com/graph/api/resources/mail-api-overview",
  },
  {
    id: "outlook_calendar",
    name: "Outlook Calendar",
    category: "calendar",
    descriptionKey: "outlookCalendar",
    authType: "oauth2",
    badge: "OAuth 2.0",
    website: "https://www.microsoft.com/microsoft-365/calendar",
    logoUrl: "/Logos/microsoft-icon.svg",
    envVars: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
    docsUrl: "https://learn.microsoft.com/graph/api/resources/calendar",
  },
  {
    id: "github",
    name: "GitHub",
    category: "engineering",
    descriptionKey: "github",
    authType: "oauth2",
    badge: "OAuth / App",
    website: "https://github.com",
    logoUrl: "/Logos/github-icon.svg",
    envVars: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
    docsUrl: "https://docs.github.com/rest",
  },
  {
    id: "linear",
    name: "Linear",
    category: "engineering",
    descriptionKey: "linear",
    authType: "api_key",
    badge: "API Key / OAuth",
    website: "https://linear.app",
    logoUrl: "/Logos/linear-icon.svg",
    envVars: ["LINEAR_API_KEY"],
    docsUrl: "https://developers.linear.app",
  },
  {
    id: "vercel",
    name: "Vercel",
    category: "operations",
    descriptionKey: "vercel",
    authType: "api_key",
    badge: "API Token",
    website: "https://vercel.com",
    logoUrl: "/Logos/vercel-icon.svg",
    envVars: ["VERCEL_TOKEN"],
    docsUrl: "https://vercel.com/docs/rest-api",
  },
  {
    id: "sentry",
    name: "Sentry",
    category: "operations",
    descriptionKey: "sentry",
    authType: "api_key",
    badge: "Auth Token",
    website: "https://sentry.io",
    logoUrl: "/Logos/sentry-icon.svg",
    envVars: ["SENTRY_AUTH_TOKEN"],
    docsUrl: "https://docs.sentry.io/api/",
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "commerce",
    descriptionKey: "stripe",
    authType: "api_key",
    badge: "API Secret",
    website: "https://stripe.com",
    logoUrl: "/Logos/stripe.svg",
    envVars: ["STRIPE_SECRET_KEY"],
    docsUrl: "https://stripe.com/docs/api",
  },
  {
    id: "shopify",
    name: "Shopify",
    category: "commerce",
    descriptionKey: "shopify",
    authType: "api_key",
    badge: "Admin API",
    website: "https://shopify.com",
    logoUrl: "/Logos/shopify.svg",
    envVars: ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET"],
    docsUrl: "https://shopify.dev/docs/api",
  },
];

export function getIntegrationById(id: IntegrationProvider | string): IntegrationDefinition | undefined {
  return INTEGRATION_CATALOG.find((item) => item.id === id);
}

export function getProviderLogoUrl(provider: string): string | undefined {
  const match = getIntegrationById(provider);
  if (match) return match.logoUrl;

  const mapping: Record<string, string> = {
    google: "/Logos/google-icon.svg",
    gmail: "/Logos/google-gmail.svg",
    google_calendar: "/Logos/google-calendar.svg",
    google_drive: "/Logos/google-drive.svg",
    microsoft: "/Logos/microsoft-icon.svg",
    outlook: "/Logos/microsoft-icon.svg",
    outlook_calendar: "/Logos/microsoft-icon.svg",
    teams: "/Logos/microsoft-teams.svg",
    github: "/Logos/github-icon.svg",
    linear: "/Logos/linear-icon.svg",
    vercel: "/Logos/vercel-icon.svg",
    sentry: "/Logos/sentry-icon.svg",
    stripe: "/Logos/stripe.svg",
    shopify: "/Logos/shopify.svg",
    slack: "/Logos/slack-icon.svg",
  };

  return mapping[provider.toLowerCase()];
}
