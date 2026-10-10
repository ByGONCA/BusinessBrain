"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { decryptToken } from "@/lib/crypto/encryption";
import { revokeGoogleToken } from "./google/oauth";
import { isValidUuid } from "@/lib/security/authorization";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { getOrganizationIntegrations } from "./queries";
import { hasPermission } from "@/lib/permissions/resolver";
import {
  OrganizationIntegration,
  EmailMessageItem,
  EmailAttachmentItem,
  GetEmailMessagesResponse,
} from "./types";
import { listGmailMessages, getGmailMessage } from "./google/gmail";
import { cleanSenderName } from "./sender-logos";

/**
 * Disconnects an organization integration, revoking external tokens,
 * clearing credentials from the database, and setting status to 'disconnected'.
 * Protected with role verification, IDOR prevention, and UUID validation.
 */
export async function disconnectIntegrationAction(integrationId: string) {
  if (!isValidUuid(integrationId)) {
    throw new Error("Invalid integration ID format.");
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    throw new Error("No active organization found.");
  }

  const supabase = await createClient();

  // Verify permission: owner has root access, or member must have 'integrations.disconnect'
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const canDisconnect = await hasPermission(user.id, activeOrg.id, "integrations.disconnect");
  if (!canDisconnect) {
    throw new Error("Forbidden: You do not have permission to disconnect workspace integrations.");
  }

  // Rate limit mutation per workspace
  const rl = await rateLimit("disconnect-integration", activeOrg.id, RATE_LIMIT_PRESETS.MUTATIONS);
  if (!rl.success) {
    throw new Error("Too many integration changes. Please try again shortly.");
  }

  // Retrieve integration credentials strictly scoped to the active organization (IDOR prevention)
  const { data: integration, error } = await supabase
    .from("organization_integrations")
    .select("id, provider, encrypted_refresh_token, encrypted_access_token")
    .eq("id", integrationId)
    .eq("organization_id", activeOrg.id)
    .single();

  if (error || !integration) {
    logger.warn("Integration not found or organization mismatch", {
      integrationId,
      organizationId: activeOrg.id,
    });
    return;
  }

  // Attempt graceful token revocation if supported
  try {
    if (
      integration.provider === "google" ||
      integration.provider === "gmail" ||
      integration.provider === "google_calendar" ||
      integration.provider === "google_drive"
    ) {
      if (integration.encrypted_refresh_token) {
        const refreshToken = decryptToken(integration.encrypted_refresh_token);
        await revokeGoogleToken(refreshToken);
      } else if (integration.encrypted_access_token) {
        const accessToken = decryptToken(integration.encrypted_access_token);
        await revokeGoogleToken(accessToken);
      }
    }
  } catch (err: unknown) {
    logger.warn("External token revocation skipped or failed", {
      provider: integration.provider,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Clear tokens and set status to disconnected
  await supabase
    .from("organization_integrations")
    .update({
      status: "disconnected",
      encrypted_access_token: null,
      encrypted_refresh_token: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId)
    .eq("organization_id", activeOrg.id);

  // Mark referenced external files as unavailable without deleting knowledge records
  if (
    integration.provider === "google" ||
    integration.provider === "google_drive"
  ) {
    await supabase
      .from("organization_files")
      .update({
        status: "unavailable",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", activeOrg.id)
      .eq("storage_provider", "google_drive");
  }

  logger.info("Successfully disconnected integration", {
    integrationId,
    organizationId: activeOrg.id,
    provider: integration.provider,
  });

  revalidatePath("/dashboard/settings/integrations");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

/**
 * Permanently removes / deletes an organization integration record.
 * Revokes external tokens if applicable and deletes the database record.
 */
export async function deleteIntegrationAction(integrationId: string) {
  if (!isValidUuid(integrationId)) {
    throw new Error("Invalid integration ID format.");
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    throw new Error("No active organization found.");
  }

  // Only owners and admins can manage integrations
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    throw new Error("You must be an owner or admin to manage organization integrations.");
  }

  const rl = await rateLimit("delete-integration", activeOrg.id, RATE_LIMIT_PRESETS.MUTATIONS);
  if (!rl.success) {
    throw new Error("Too many integration changes. Please try again shortly.");
  }

  const supabase = await createClient();

  // Retrieve credentials for graceful token revocation
  const { data: integration } = await supabase
    .from("organization_integrations")
    .select("id, provider, encrypted_refresh_token, encrypted_access_token")
    .eq("id", integrationId)
    .eq("organization_id", activeOrg.id)
    .single();

  if (
    integration &&
    (integration.provider === "google" ||
      integration.provider === "gmail" ||
      integration.provider === "google_calendar" ||
      integration.provider === "google_drive")
  ) {
    try {
      if (integration.encrypted_refresh_token) {
        const refreshToken = decryptToken(integration.encrypted_refresh_token);
        await revokeGoogleToken(refreshToken);
      } else if (integration.encrypted_access_token) {
        const accessToken = decryptToken(integration.encrypted_access_token);
        await revokeGoogleToken(accessToken);
      }
    } catch (err: unknown) {
      logger.warn("External token revocation skipped or failed", {
        provider: integration.provider,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const { error } = await supabase
    .from("organization_integrations")
    .delete()
    .eq("id", integrationId)
    .eq("organization_id", activeOrg.id);

  if (error) {
    logger.error("Failed to delete integration record", error);
    throw new Error("Failed to delete integration account.");
  }

  logger.info("Successfully deleted integration account", {
    integrationId,
    organizationId: activeOrg.id,
  });

  revalidatePath("/dashboard/settings/integrations");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/email");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");

  return { success: true };
}

/**
 * Retrieves all integrations for the currently active organization.
 */
export async function getOrganizationIntegrationsAction(): Promise<OrganizationIntegration[]> {
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) return [];
  return getOrganizationIntegrations(activeOrg.id);
}

/**
 * Retrieves synced email messages for the workspace with account filtering, search, and cursor page token.
 * Requests exactly 10 emails per request to the Gmail API.
 */
export async function getEmailMessagesAction(params?: {
  accountEmail?: string;
  search?: string;
  pageToken?: string;
}): Promise<GetEmailMessagesResponse> {
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) return { messages: [], isLive: false };

  try {
    const gmailResult = await listGmailMessages(activeOrg.id, {
      accountEmail: params?.accountEmail,
      query: params?.search,
      pageToken: params?.pageToken,
      maxResults: 10,
    });

    if (gmailResult.messages && gmailResult.messages.length > 0) {
      const messages: EmailMessageItem[] = gmailResult.messages.map((m) => {
        const fromHeader = m.from || "";
        const fromMatch = fromHeader.match(/^(.*?)\s*<(.+?)>$/);
        const rawSender = fromMatch ? fromMatch[1].replace(/^["']|["']$/g, "").trim() : fromHeader || "Unknown Sender";
        const senderEmail = fromMatch ? fromMatch[2].trim() : fromHeader;
        const sender = cleanSenderName(rawSender, senderEmail);

        // Sanitize snippet & subject from HTML entities and excessive whitespace
        const cleanSubject = (m.subject || "(No Subject)")
          .replace(/&#39;|&apos;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        const cleanSnippet = (m.snippet || "")
          .replace(/&#39;|&apos;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        let dateDisplay = "Today";
        let timeDisplay = "";

        if (m.date) {
          try {
            const d = new Date(m.date);
            if (!isNaN(d.getTime())) {
              const now = new Date();
              const isToday =
                d.getDate() === now.getDate() &&
                d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear();

              const yesterday = new Date();
              yesterday.setDate(now.getDate() - 1);
              const isYesterday =
                d.getDate() === yesterday.getDate() &&
                d.getMonth() === yesterday.getMonth() &&
                d.getFullYear() === yesterday.getFullYear();

              timeDisplay = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

              if (isToday) {
                dateDisplay = "Today";
              } else if (isYesterday) {
                dateDisplay = "Yesterday";
              } else {
                dateDisplay = d.toLocaleDateString([], { month: "short", day: "numeric" });
              }
            }
          } catch {
            dateDisplay = m.date;
          }
        }

        return {
          id: m.id,
          sender: sender || "Sender",
          senderEmail: senderEmail || "unknown@domain.com",
          recipientEmail: m.to || params?.accountEmail || "",
          subject: cleanSubject,
          snippet: cleanSnippet,
          body: cleanSnippet,
          date: dateDisplay,
          time: timeDisplay,
          unread: !!m.unread,
          source: "Gmail" as const,
          accountEmail: params?.accountEmail || "",
        };
      });

      return {
        messages,
        nextPageToken: gmailResult.nextPageToken,
        isLive: true,
      };
    }
  } catch (err) {
    logger.warn("Live Gmail message fetch failed or skipped, using fallback", {
      orgId: activeOrg.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { messages: [], isLive: false };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Retrieves full decoded message body and attachment metadata for a specific email on-demand.
 * Called only when an email is opened. Zero storage cost.
 */
export async function getEmailMessageContentAction(params: {
  messageId: string;
  accountEmail?: string;
}): Promise<{ body: string; htmlBody?: string; attachments?: EmailAttachmentItem[] } | null> {
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) return null;

  try {
    const full = await getGmailMessage(activeOrg.id, params.messageId, params.accountEmail);

    const attachments: EmailAttachmentItem[] = (full.attachments || []).map((att) => ({
      name: att.filename,
      size: formatBytes(att.size),
      attachmentId: att.attachmentId,
      mimeType: att.mimeType,
    }));

    return {
      body: full.body,
      htmlBody: full.htmlBody,
      attachments,
    };
  } catch (err) {
    console.error(`[DEBUG_EMAIL] Error getting gmail message:`, err);
    return null;
  }
}


