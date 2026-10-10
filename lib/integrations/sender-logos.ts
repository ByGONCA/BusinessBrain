/**
 * Deterministic sender logo resolver.
 * Maps email sender domains to verified local static SVGs in public/logos.
 * Strictly local, offline, deterministic — zero AI and zero external network requests.
 */

const DOMAIN_TO_LOGO_MAP: Record<string, string> = {
  // Google / Gmail
  "gmail.com": "/logos/google-gmail.svg",
  "googlemail.com": "/logos/google-gmail.svg",
  "google.com": "/logos/google-icon.svg",

  // Microsoft / Outlook / Hotmail / Live
  "outlook.com": "/logos/microsoft-icon.svg",
  "hotmail.com": "/logos/microsoft-icon.svg",
  "live.com": "/logos/microsoft-icon.svg",
  "msn.com": "/logos/microsoft-icon.svg",
  "microsoft.com": "/logos/microsoft-icon.svg",
  "office.com": "/logos/microsoft-icon.svg",
  "office365.com": "/logos/microsoft-icon.svg",
  "azure.com": "/logos/microsoft-azure.svg",

  // Developer & Infrastructure
  "stripe.com": "/logos/stripe.svg",
  "vercel.com": "/logos/vercel-icon.svg",
  "vercel.app": "/logos/vercel-icon.svg",
  "github.com": "/logos/github-icon.svg",
  "supabase.com": "/logos/supabase-icon.svg",
  "supabase.io": "/logos/supabase-icon.svg",
  "linear.app": "/logos/linear-icon.svg",
  "resend.com": "/logos/resend-icon.svg",
  "aws.amazon.com": "/logos/aws.svg",
  "amazon.com": "/logos/aws.svg",
  "amazonaws.com": "/logos/aws.svg",
  "cloudflare.com": "/logos/cloudflare.svg",
  "openai.com": "/logos/openai-icon.svg",
  "postman.com": "/logos/postman-icon.svg",
  "sentry.io": "/logos/sentry-icon.svg",
  "notion.so": "/logos/notion-icon.svg",
  "notion.com": "/logos/notion-icon.svg",
  "mailgun.com": "/logos/mailgun-icon.svg",
  "mailchimp.com": "/logos/mailchimp-icon.svg",
  "postgresql.org": "/logos/postgresql.svg",

  // Productivity & Communication
  "slack.com": "/logos/slack-icon.svg",
  "figma.com": "/logos/figma.svg",
  "hubspot.com": "/logos/hubspot.svg",
  "apple.com": "/logos/apple.svg",
  "icloud.com": "/logos/apple.svg",
  "yahoo.com": "/logos/yahoo.svg",
  "ymail.com": "/logos/yahoo.svg",
  "zendesk.com": "/logos/zendesk-icon.svg",
  "zapier.com": "/logos/zapier.svg",
  "zoom.us": "/logos/zoom-icon.svg",
  "linkedin.com": "/logos/linkedin-icon.svg",
  "youtube.com": "/logos/youtube-icon.svg",
  "twitter.com": "/logos/x.svg",
  "x.com": "/logos/x.svg",
  // Social & Media
  "tiktok.com": "/logos/tiktok-icon.svg",
  "tiktokv.com": "/logos/tiktok-icon.svg",
  "spotify.com": "/logos/spotify-icon.svg",
  "netflix.com": "/logos/netflix-icon.svg",
  "instagram.com": "/logos/instagram-icon.svg",
  "facebook.com": "/logos/facebook.svg",
  "facebookmail.com": "/logos/facebook.svg",
  "reddit.com": "/logos/reddit-icon.svg",
  "redditmail.com": "/logos/reddit-icon.svg",
  "discord.com": "/logos/discord-icon.svg",
  "discordapp.com": "/logos/discord-icon.svg",
  "twitch.tv": "/logos/twitch.svg",
  "telegram.org": "/logos/telegram.svg",
  "whatsapp.com": "/logos/whatsapp-icon.svg",
  "medium.com": "/logos/medium-icon.svg",

  // Business & Project Management
  "paypal.com": "/logos/paypal.svg",
  "asana.com": "/logos/asana-icon.svg",
  "trello.com": "/logos/trello.svg",
  "dropbox.com": "/logos/dropbox.svg",
  "dropboxmail.com": "/logos/dropbox.svg",
  "airbnb.com": "/logos/airbnb-icon.svg",
  "gitlab.com": "/logos/gitlab-icon.svg",
  "adobe.com": "/logos/adobe.svg",
  "jira.com": "/logos/jira.svg",
  "atlassian.com": "/logos/atlassian.svg",
  "intercom.com": "/logos/intercom-icon.svg",
  "intercom-mail.com": "/logos/intercom-icon.svg",
  "loom.com": "/logos/loom-icon.svg",
  "miro.com": "/logos/miro-icon.svg",
  "monday.com": "/logos/monday-icon.svg",
  "clickup.com": "/logos/clickup-icon.svg",
};

/**
 * Extracts and normalizes the domain from an email address or RFC 5322 From string.
 * Example: "Stripe Team <billing@stripe.com>" -> "stripe.com"
 * Example: "notifications@github.com" -> "github.com"
 */
export function extractDomainFromEmail(emailOrSender: string | null | undefined): string | null {
  if (!emailOrSender) return null;

  // Handle RFC 5322 header formats like "Name <user@domain.com>"
  const angleMatch = emailOrSender.match(/<([^>]+)>/);
  const rawEmail = angleMatch ? angleMatch[1] : emailOrSender;

  const atIndex = rawEmail.lastIndexOf("@");
  if (atIndex === -1) return null;

  const domain = rawEmail.slice(atIndex + 1).trim().toLowerCase();
  // Remove any trailing whitespace, commas, or quotes
  return domain.replace(/[^a-z0-9.-]/g, "") || null;
}

/**
 * Resolves a local static logo from public/logos for a given sender email address.
 * Returns the relative path (e.g. "/logos/stripe.svg") or null if no matching logo exists.
 * Strictly local and deterministic.
 */
export function resolveSenderLogo(emailOrSender: string | null | undefined): string | null {
  const domain = extractDomainFromEmail(emailOrSender);
  if (!domain) return null;

  // 1. Direct match on full domain (e.g. "gmail.com")
  if (DOMAIN_TO_LOGO_MAP[domain]) {
    return DOMAIN_TO_LOGO_MAP[domain];
  }

  // 2. Check parent domain if it's a subdomain (e.g. "notifications.github.com" -> "github.com")
  const parts = domain.split(".");
  if (parts.length > 2) {
    const parentDomain = parts.slice(-2).join(".");
    if (DOMAIN_TO_LOGO_MAP[parentDomain]) {
      return DOMAIN_TO_LOGO_MAP[parentDomain];
    }
  }

  return null;
}

const AVATAR_PALETTES = [
  { bg: "bg-blue-500/10 dark:bg-blue-500/20", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20 dark:border-blue-500/30" },
  { bg: "bg-purple-500/10 dark:bg-purple-500/20", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20 dark:border-purple-500/30" },
  { bg: "bg-emerald-500/10 dark:bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20 dark:border-emerald-500/30" },
  { bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20 dark:border-amber-500/30" },
  { bg: "bg-rose-500/10 dark:bg-rose-500/20", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/20 dark:border-rose-500/30" },
  { bg: "bg-indigo-500/10 dark:bg-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/20 dark:border-indigo-500/30" },
  { bg: "bg-teal-500/10 dark:bg-teal-500/20", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/20 dark:border-teal-500/30" },
  { bg: "bg-cyan-500/10 dark:bg-cyan-500/20", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/20 dark:border-cyan-500/30" },
];

/**
 * Cleans and formats sender names.
 * When sender is an email address like "no-reply@notifications.cttexpress.com",
 * extracts the brand name e.g. "CTT Express".
 */
export function cleanSenderName(sender: string | null | undefined, email?: string | null): string {
  const raw = (sender || "").replace(/<[^>]+>/g, "").replace(/^["']|["']$/g, "").trim();

  // If already a clean human/brand name without '@'
  if (raw && !raw.includes("@")) {
    return raw;
  }

  // Sender is an email address
  const targetEmail = email && email.includes("@") ? email : raw;
  const atIdx = targetEmail.lastIndexOf("@");
  if (atIdx === -1) return raw || "Sender";

  const domain = targetEmail.slice(atIdx + 1).toLowerCase();
  const parts = domain.split(".");
  let candidate =
    parts.length > 2 && parts[parts.length - 2].length > 2
      ? parts[parts.length - 2]
      : parts[0];

  if (candidate === "notifications" || candidate === "mail" || candidate === "news") {
    candidate = parts[parts.length - 2] || parts[0];
  }

  if (candidate.includes("cttexpress") || candidate.includes("ctt")) {
    return "CTT Express";
  }

  return candidate.charAt(0).toUpperCase() + candidate.slice(1);
}

/**
 * Generates initials for a sender name or email.
 * E.g. "Indie Hackers" -> "IH", "Revolut" -> "R", "David Lenoir | D'AZUR" -> "DL"
 */
export function getSenderInitials(sender: string | null | undefined, email?: string | null): string {
  const clean = cleanSenderName(sender, email);
  if (clean) {
    const parts = clean
      .split(/[\s|_-]+/)
      .filter((p) => p.length > 0 && /^[a-zA-Z0-9]/.test(p));
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length > 0) {
      return parts[0][0].toUpperCase();
    }
  }

  const domain = extractDomainFromEmail(email || sender);
  if (domain) {
    const main = domain.split(".")[0];
    return main.slice(0, 1).toUpperCase();
  }

  return "E";
}

/**
 * Returns a deterministic stylish color palette for senders without a dedicated logo.
 */
export function getSenderAvatarPalette(seed: string | null | undefined) {
  const str = (seed || "email").toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}
