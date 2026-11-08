"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { decryptToken } from "@/lib/crypto/encryption";
import { revokeGoogleToken } from "./google/oauth";
import { revokeGitHubToken } from "./github/oauth";
import { revokeLinearToken } from "./linear/oauth";
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
import {
  listGmailMessages,
  getGmailMessage,
  isValidGmailId,
  createGmailDraft,
  updateGmailDraft,
  sendGmailDraft,
  getGmailDraft,
  GmailDraftInput,
  GmailDraftItem,
} from "./google/gmail";
import {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  CreateGoogleCalendarEventInput,
  UpdateGoogleCalendarEventInput,
} from "./google/calendar";
import {
  createOutlookCalendarEvent,
  updateOutlookCalendarEvent,
  deleteOutlookCalendarEvent,
  CreateOutlookCalendarEventInput,
  UpdateOutlookCalendarEventInput,
} from "./microsoft/calendar";
import { getStripeClient } from "@/lib/stripe/client";
import { getGitHubViewer } from "./github/client";
import { getAuthenticatedGoogleClient } from "./google/client";
import { getAuthenticatedMicrosoftClient } from "./microsoft/client";
import { isGoogleIntegrationConfigured } from "./google/config";
import { isMicrosoftIntegrationConfigured } from "./microsoft/config";
import {
  createActionApprovalTicket,
  verifyActionApprovalTicket,
  cancelActionApprovalTicket,
  ActionApprovalTicket,
  GuardrailActionType,
} from "./guardrails";
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

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

  // Verify permission: requires integrations.disconnect, github.manage_connection, or linear.manage_connection
  const isGitHub = integration.provider === "github";
  const isLinear = integration.provider === "linear";
  const canDisconnect = isGitHub
    ? (await hasPermission(user.id, activeOrg.id, "github.manage_connection")) ||
      (await hasPermission(user.id, activeOrg.id, "integrations.disconnect"))
    : isLinear
    ? (await hasPermission(user.id, activeOrg.id, "linear.manage_connection")) ||
      (await hasPermission(user.id, activeOrg.id, "integrations.disconnect"))
    : await hasPermission(user.id, activeOrg.id, "integrations.disconnect");

  if (!canDisconnect) {
    throw new Error("Forbidden: You do not have permission to disconnect workspace integrations.");
  }

  // Rate limit mutation per workspace
  const rl = await rateLimit("disconnect-integration", activeOrg.id, RATE_LIMIT_PRESETS.MUTATIONS);
  if (!rl.success) {
    throw new Error("Too many integration changes. Please try again shortly.");
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
    } else if (integration.provider === "github") {
      if (integration.encrypted_access_token) {
        const accessToken = decryptToken(integration.encrypted_access_token);
        await revokeGitHubToken(accessToken);
      }
    } else if (integration.provider === "linear") {
      if (integration.encrypted_access_token) {
        const accessToken = decryptToken(integration.encrypted_access_token);
        await revokeLinearToken(accessToken);
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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Retrieve credentials for graceful token revocation
  const { data: integration } = await supabase
    .from("organization_integrations")
    .select("id, provider, encrypted_refresh_token, encrypted_access_token")
    .eq("id", integrationId)
    .eq("organization_id", activeOrg.id)
    .maybeSingle();

  if (!integration) {
    return { success: true };
  }

  // Verify permission: requires integrations.disconnect or github.manage_connection
  const isGitHub = integration.provider === "github";
  const canDelete = isGitHub
    ? (await hasPermission(user.id, activeOrg.id, "github.manage_connection")) ||
      (await hasPermission(user.id, activeOrg.id, "integrations.disconnect"))
    : await hasPermission(user.id, activeOrg.id, "integrations.disconnect");

  if (!canDelete) {
    throw new Error("Forbidden: You do not have permission to delete workspace integrations.");
  }

  const rl = await rateLimit("delete-integration", activeOrg.id, RATE_LIMIT_PRESETS.MUTATIONS);
  if (!rl.success) {
    throw new Error("Too many integration changes. Please try again shortly.");
  }

  if (integration) {
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
      } else if (integration.provider === "github") {
        if (integration.encrypted_access_token) {
          const accessToken = decryptToken(integration.encrypted_access_token);
          await revokeGitHubToken(accessToken);
        }
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
 * Enforces integrations.view permission.
 */
export async function getOrganizationIntegrationsAction(): Promise<OrganizationIntegration[]> {
  const activeOrg = await getActiveOrganization();
  if (!activeOrg) return [];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const canView = await hasPermission(user.id, activeOrg.id, "integrations.view");
  if (!canView) return [];
  return getOrganizationIntegrations(activeOrg.id);
}

/**
 * Retrieves synced email messages for the workspace with account filtering, search, and cursor page token.
 * Requests exactly 10 emails per request to the Gmail API.
 * Requires active session, workspace membership, and integrations.view permission.
 */
export async function getEmailMessagesAction(params?: {
  accountEmail?: string;
  search?: string;
  pageToken?: string;
}): Promise<GetEmailMessagesResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { messages: [], isLive: false, error: "unauthorized" };
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return { messages: [], isLive: false, error: "forbidden" };
  }

  // Enforce server-side authorization: caller must have 'integrations.view' or owner role
  const canView = await hasPermission(user.id, activeOrg.id, "integrations.view");
  if (!canView) {
    logger.warn("Unauthorized attempt to access workspace emails", {
      userId: user.id,
      organizationId: activeOrg.id,
    });
    return { messages: [], isLive: false, error: "forbidden" };
  }

  // Rate limit email listing per user to prevent Google API quota exhaustion
  const rl = await rateLimit("get-email-messages", user.id, RATE_LIMIT_PRESETS.API_STANDARD);
  if (!rl.success) {
    logger.warn("Rate limit exceeded on getEmailMessagesAction", { userId: user.id });
    return { messages: [], isLive: false, error: "rate_limited" };
  }

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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isReauthNeeded =
      errorMsg.includes("needs_reauth") ||
      errorMsg.includes("reconnect") ||
      errorMsg.includes("expired") ||
      errorMsg.includes("invalid_grant");

    logger.warn("Live Gmail message fetch failed or skipped", {
      orgId: activeOrg.id,
      error: errorMsg,
      isReauthNeeded,
    });

    return {
      messages: [],
      isLive: false,
      error: isReauthNeeded ? "needs_reauth" : "provider_error",
    };
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
 * Strictly verifies authentication, integrations.view permission, and messageId format.
 */
export async function getEmailMessageContentAction(params: {
  messageId: string;
  accountEmail?: string;
}): Promise<{ body: string; htmlBody?: string; attachments?: EmailAttachmentItem[] } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) return null;

  // Enforce server-side authorization
  const canView = await hasPermission(user.id, activeOrg.id, "integrations.view");
  if (!canView) {
    logger.warn("Unauthorized attempt to access email content", {
      userId: user.id,
      organizationId: activeOrg.id,
    });
    return null;
  }

  // Validate messageId format to prevent path traversal or injection
  if (!params.messageId || !isValidGmailId(params.messageId)) {
    logger.warn("Invalid messageId format provided to getEmailMessageContentAction", {
      messageId: params.messageId,
    });
    return null;
  }

  // Rate limit content fetching per user
  const rl = await rateLimit("get-email-content", user.id, RATE_LIMIT_PRESETS.API_STANDARD);
  if (!rl.success) {
    logger.warn("Rate limit exceeded on getEmailMessageContentAction", { userId: user.id });
    return null;
  }

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
  } catch (err: unknown) {
    logger.error("Error retrieving gmail message content", err, {
      organizationId: activeOrg.id,
      messageId: params.messageId,
    });
    return null;
  }
}




/**
 * Prepares a Gmail draft and issues a cryptographically bound ActionApprovalTicket.
 * Invariant: The email is NEVER sent by this function. It creates a draft in Gmail
 * and returns the ticket for human review and explicit confirmation.
 */
export async function prepareEmailDraftAction(input: GmailDraftInput): Promise<{
  success: boolean;
  draft: GmailDraftItem;
  ticket: ActionApprovalTicket;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) throw new Error("No active organization found");

  // Check permission: integrations.view
  const canView = await hasPermission(user.id, activeOrg.id, "integrations.view");
  if (!canView) {
    throw new Error("Forbidden: You do not have permission to view/create email drafts.");
  }

  const rl = await rateLimit("prepare-email-draft", user.id, RATE_LIMIT_PRESETS.MUTATIONS);
  if (!rl.success) {
    throw new Error("Rate limit exceeded. Please wait before preparing another draft.");
  }

  const draft = await createGmailDraft(activeOrg.id, input, { userId: user.id });

  const payloadToLock = {
    draftId: draft.id,
    to: input.to,
    cc: input.cc || null,
    bcc: input.bcc || null,
    subject: input.subject,
    body: input.body,
  };

  const ticket = createActionApprovalTicket({
    actionType: "email.send",
    payload: payloadToLock,
    organizationId: activeOrg.id,
    userId: user.id,
  });

  return { success: true, draft, ticket };
}

/**
 * Updates an existing draft and issues a fresh ActionApprovalTicket for the mutated content.
 * Any previous approval ticket for this draft is automatically invalidated because the payload hash changed.
 */
export async function updateEmailDraftAction(
  draftId: string,
  input: GmailDraftInput
): Promise<{
  success: boolean;
  draft: GmailDraftItem;
  ticket: ActionApprovalTicket;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) throw new Error("No active organization found");

  const canView = await hasPermission(user.id, activeOrg.id, "integrations.view");
  if (!canView) {
    throw new Error("Forbidden: You do not have permission to update email drafts.");
  }

  const draft = await updateGmailDraft(activeOrg.id, draftId, input, { userId: user.id });

  const payloadToLock = {
    draftId: draft.id,
    to: input.to,
    cc: input.cc || null,
    bcc: input.bcc || null,
    subject: input.subject,
    body: input.body,
  };

  const ticket = createActionApprovalTicket({
    actionType: "email.send",
    payload: payloadToLock,
    organizationId: activeOrg.id,
    userId: user.id,
  });

  return { success: true, draft, ticket };
}

/**
 * Sends a previously prepared draft ONLY after verifying human approval:
 * 1. Verifies caller permissions (owner/admin or 'integrations.send_mail').
 * 2. Re-computes SHA-256 of payload against ticket.payloadHash. If ANY field changed, fails closed.
 * 3. Enforces ticket signature, expiration, and single-use anti-replay.
 * 4. Dispatches the email through official Gmail API.
 */
export async function sendApprovedEmailDraftAction(
  ticket: ActionApprovalTicket,
  currentPayload: {
    draftId: string;
    to: string | string[];
    cc?: string | string[] | null;
    bcc?: string | string[] | null;
    subject: string;
    body: string;
  }
): Promise<{ success: boolean; messageId: string; threadId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) throw new Error("No active organization found");

  // Multi-tenant check: ticket must belong to active workspace and current user
  if (ticket.organizationId !== activeOrg.id || ticket.userId !== user.id) {
    throw new Error("Security violation: Workspace or user mismatch on email approval ticket.");
  }

  // Authorization check: owner, admin, or explicit 'integrations.send_mail' permission
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", activeOrg.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const isOwnerOrAdmin = member?.role === "owner" || member?.role === "admin";
  const canSend = isOwnerOrAdmin || (await hasPermission(user.id, activeOrg.id, "integrations.send_mail"));

  if (!canSend) {
    throw new Error("Forbidden: You do not have permission to send emails from this workspace.");
  }

  // Verify ticket cryptographic guardrail & payload immutability
  const verification = verifyActionApprovalTicket({
    ticket,
    currentPayload,
    organizationId: activeOrg.id,
    userId: user.id,
    markConsumed: true,
  });

  if (!verification.valid) {
    logger.warn("Security violation: sendApprovedEmailDraftAction rejected", {
      code: verification.code,
      error: verification.error,
      draftId: currentPayload.draftId,
      organizationId: activeOrg.id,
      userId: user.id,
    });
    throw new Error(`Email approval validation failed: ${verification.error}`);
  }

  // Send draft via Gmail API
  const result = await sendGmailDraft(activeOrg.id, currentPayload.draftId, { userId: user.id });

  logger.info("Email draft successfully dispatched after verified human confirmation", {
    organizationId: activeOrg.id,
    userId: user.id,
    draftId: currentPayload.draftId,
    messageId: result.id,
  });

  revalidatePath("/dashboard/email");
  revalidatePath("/dashboard");

  return { success: true, messageId: result.id, threadId: result.threadId };
}

/**
 * Prepares an ActionApprovalTicket for calendar mutations (create, update, delete).
 */
export async function prepareCalendarAction(params: {
  actionType: "calendar.create" | "calendar.update" | "calendar.delete";
  provider: "google" | "microsoft";
  payload: unknown;
}): Promise<{ success: boolean; ticket: ActionApprovalTicket }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) throw new Error("No active organization found");

  const ticket = createActionApprovalTicket({
    actionType: params.actionType,
    payload: { provider: params.provider, ...((params.payload as object) || {}) },
    organizationId: activeOrg.id,
    userId: user.id,
  });

  return { success: true, ticket };
}

/**
 * Executes a calendar mutation (Google or Microsoft) after explicit human confirmation.
 */
export async function executeApprovedCalendarAction(params: {
  ticket: ActionApprovalTicket;
  provider: "google" | "microsoft";
  actionType: "calendar.create" | "calendar.update" | "calendar.delete";
  payload: any;
}): Promise<{ success: boolean; result?: unknown }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) throw new Error("No active organization found");

  // Authorization check for meetings
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", activeOrg.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const isOwnerOrAdmin = member?.role === "owner" || member?.role === "admin";
  const requiredPerm =
    params.actionType === "calendar.create"
      ? "meetings.create"
      : params.actionType === "calendar.update"
      ? "meetings.edit"
      : "meetings.delete";

  const hasPerm = isOwnerOrAdmin || (await hasPermission(user.id, activeOrg.id, requiredPerm));
  if (!hasPerm) {
    throw new Error(`Forbidden: You do not have permission for '${requiredPerm}'.`);
  }

  // Verify ticket cryptographic guardrail & payload immutability
  const payloadToVerify = { provider: params.provider, ...(params.payload || {}) };
  const verification = verifyActionApprovalTicket({
    ticket: params.ticket,
    currentPayload: payloadToVerify,
    organizationId: activeOrg.id,
    userId: user.id,
    markConsumed: true,
  });

  if (!verification.valid) {
    logger.warn("Calendar action approval failed", {
      code: verification.code,
      error: verification.error,
      organizationId: activeOrg.id,
    });
    throw new Error(`Calendar approval validation failed: ${verification.error}`);
  }

  let executionResult: unknown;

  if (params.provider === "google") {
    if (params.actionType === "calendar.create") {
      executionResult = await createGoogleCalendarEvent(activeOrg.id, {
        ...params.payload,
        userId: user.id,
      });
    } else if (params.actionType === "calendar.update") {
      executionResult = await updateGoogleCalendarEvent(activeOrg.id, params.payload.eventId, {
        ...params.payload,
        userId: user.id,
      });
    } else if (params.actionType === "calendar.delete") {
      await deleteGoogleCalendarEvent(activeOrg.id, params.payload.eventId, params.payload.calendarId, user.id);
      executionResult = { deleted: true };
    }
  } else {
    // Microsoft
    if (params.actionType === "calendar.create") {
      executionResult = await createOutlookCalendarEvent(activeOrg.id, {
        ...params.payload,
        userId: user.id,
      });
    } else if (params.actionType === "calendar.update") {
      executionResult = await updateOutlookCalendarEvent(activeOrg.id, params.payload.eventId, {
        ...params.payload,
        userId: user.id,
      });
    } else if (params.actionType === "calendar.delete") {
      await deleteOutlookCalendarEvent(activeOrg.id, params.payload.eventId, user.id);
      executionResult = { deleted: true };
    }
  }

  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");

  return { success: true, result: executionResult };
}

/**
 * Cancels a pending action ticket explicitly.
 */
export async function cancelActionTicketAction(ticketId: string): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) throw new Error("No active organization found");

  const cancelled = cancelActionApprovalTicket(ticketId, activeOrg.id, user.id);
  return { success: cancelled };
}

export interface TestConnectionResult {
  success: boolean;
  status: "connected" | "needs_reauth" | "error" | "disconnected";
  message: string;
  accountIdentifier?: string;
  lastSyncAt?: string;
}

export interface ProviderConfigStatus {
  isConfigured: boolean;
  missingVars: string[];
}

/**
 * Returns configuration readiness status for all external integration providers,
 * verifying environment variables without exposing secret values to the client.
 */
export async function getIntegrationConfigStatusAction(): Promise<
  Record<string, ProviderConfigStatus>
> {
  const isGoogle = isGoogleIntegrationConfigured();
  const missingGoogle: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID) missingGoogle.push("GOOGLE_CLIENT_ID");
  if (!process.env.GOOGLE_CLIENT_SECRET) missingGoogle.push("GOOGLE_CLIENT_SECRET");

  const isMicrosoft = isMicrosoftIntegrationConfigured();
  const missingMicrosoft: string[] = [];
  if (!process.env.MICROSOFT_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID.includes("your-")) {
    missingMicrosoft.push("MICROSOFT_CLIENT_ID");
  }
  if (!process.env.MICROSOFT_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET.includes("your-")) {
    missingMicrosoft.push("MICROSOFT_CLIENT_SECRET");
  }

  const isGitHub = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  const missingGitHub: string[] = [];
  if (!process.env.GITHUB_CLIENT_ID) missingGitHub.push("GITHUB_CLIENT_ID");
  if (!process.env.GITHUB_CLIENT_SECRET) missingGitHub.push("GITHUB_CLIENT_SECRET");

  const isStripe = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_CONNECT_CLIENT_ID);
  const missingStripe: string[] = [];
  if (!process.env.STRIPE_SECRET_KEY) missingStripe.push("STRIPE_SECRET_KEY");
  if (!process.env.STRIPE_CONNECT_CLIENT_ID) missingStripe.push("STRIPE_CONNECT_CLIENT_ID");

  return {
    gmail: { isConfigured: isGoogle, missingVars: missingGoogle },
    google_calendar: { isConfigured: isGoogle, missingVars: missingGoogle },
    google_drive: { isConfigured: isGoogle, missingVars: missingGoogle },
    google: { isConfigured: isGoogle, missingVars: missingGoogle },
    outlook: { isConfigured: isMicrosoft, missingVars: missingMicrosoft },
    outlook_calendar: { isConfigured: isMicrosoft, missingVars: missingMicrosoft },
    microsoft: { isConfigured: isMicrosoft, missingVars: missingMicrosoft },
    github: { isConfigured: isGitHub, missingVars: missingGitHub },
    stripe: { isConfigured: isStripe, missingVars: missingStripe },
  };
}

/**
 * Actively tests connectivity to an external service for a connected integration.
 * Makes a real API call to the provider, verifies token validity, and updates last_sync_at on success.
 * If authentication has expired or was revoked, sets status to 'needs_reauth'.
 */
export async function testIntegrationConnectionAction(
  integrationId: string
): Promise<TestConnectionResult> {
  if (!isValidUuid(integrationId)) {
    return { success: false, status: "error", message: "Invalid integration ID format." };
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return { success: false, status: "error", message: "No active workspace selected." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, status: "error", message: "Unauthorized: Please log in." };
  }

  const canTest = await hasPermission(user.id, activeOrg.id, "integrations.view");
  if (!canTest) {
    return { success: false, status: "error", message: "Forbidden: You do not have permission to inspect integrations." };
  }

  const { data: integration, error } = await supabase
    .from("organization_integrations")
    .select("id, organization_id, provider, provider_account_id, account_email, status, last_sync_at")
    .eq("id", integrationId)
    .eq("organization_id", activeOrg.id)
    .single();

  if (error || !integration) {
    return { success: false, status: "disconnected", message: "Integration not found." };
  }

  const now = new Date().toISOString();

  try {
    if (integration.provider === "stripe") {
      const stripe = getStripeClient();
      const account = await stripe.accounts.retrieve(integration.provider_account_id);
      await supabase
        .from("organization_integrations")
        .update({ last_sync_at: now, status: "connected", updated_at: now })
        .eq("id", integration.id);

      return {
        success: true,
        status: "connected",
        message: `Conexão Stripe ativa e verificada (${account.id} • ${account.default_currency?.toUpperCase() || "EUR"}).`,
        accountIdentifier: account.id,
        lastSyncAt: now,
      };
    }

    if (
      integration.provider === "google" ||
      integration.provider === "gmail" ||
      integration.provider === "google_calendar" ||
      integration.provider === "google_drive"
    ) {
      const { googleFetch } = await getAuthenticatedGoogleClient(activeOrg.id, {
        accountEmail: integration.account_email,
      });
      const res = await googleFetch("https://www.googleapis.com/oauth2/v2/userinfo");
      if (!res.ok) {
        if (res.status === 401) {
          await supabase
            .from("organization_integrations")
            .update({ status: "needs_reauth", updated_at: now })
            .eq("id", integration.id);
          return {
            success: false,
            status: "needs_reauth",
            message: "Sessão Google expirada ou revogada. Por favor reautorize.",
            accountIdentifier: integration.account_email,
          };
        }
        throw new Error(`Google API returned status ${res.status}`);
      }
      const data = await res.json();
      await supabase
        .from("organization_integrations")
        .update({ last_sync_at: now, status: "connected", updated_at: now })
        .eq("id", integration.id);

      return {
        success: true,
        status: "connected",
        message: `Conexão Google Workspace verificada (${data.email || integration.account_email}).`,
        accountIdentifier: data.email || integration.account_email,
        lastSyncAt: now,
      };
    }

    if (integration.provider === "github") {
      const viewer = await getGitHubViewer(activeOrg.id);
      await supabase
        .from("organization_integrations")
        .update({ last_sync_at: now, status: "connected", updated_at: now })
        .eq("id", integration.id);

      return {
        success: true,
        status: "connected",
        message: `Conexão GitHub ativa e autenticada como @${viewer.login}.`,
        accountIdentifier: `@${viewer.login}`,
        lastSyncAt: now,
      };
    }

    if (
      integration.provider === "microsoft" ||
      integration.provider === "outlook" ||
      integration.provider === "outlook_calendar"
    ) {
      const { microsoftFetch } = await getAuthenticatedMicrosoftClient(activeOrg.id, {
        accountEmail: integration.account_email,
      });
      const res = await microsoftFetch("/me");
      if (!res.ok) {
        if (res.status === 401) {
          await supabase
            .from("organization_integrations")
            .update({ status: "needs_reauth", updated_at: now })
            .eq("id", integration.id);
          return {
            success: false,
            status: "needs_reauth",
            message: "Sessão Microsoft expirada ou revogada. Por favor reautorize.",
            accountIdentifier: integration.account_email,
          };
        }
        throw new Error(`Microsoft Graph API returned status ${res.status}`);
      }
      const data = await res.json();
      await supabase
        .from("organization_integrations")
        .update({ last_sync_at: now, status: "connected", updated_at: now })
        .eq("id", integration.id);

      return {
        success: true,
        status: "connected",
        message: `Conexão Microsoft 365 verificada (${data.mail || data.userPrincipalName || integration.account_email}).`,
        accountIdentifier: data.mail || data.userPrincipalName || integration.account_email,
        lastSyncAt: now,
      };
    }

    return {
      success: true,
      status: "connected",
      message: `Integração ${integration.provider} registrada no workspace.`,
      accountIdentifier: integration.account_email || integration.provider_account_id,
      lastSyncAt: integration.last_sync_at || now,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn("Test connection failed for integration", {
      integrationId,
      provider: integration.provider,
      error: errorMsg,
    });

    if (errorMsg.includes("expired") || errorMsg.includes("401") || errorMsg.includes("reconnect")) {
      await supabase
        .from("organization_integrations")
        .update({ status: "needs_reauth", updated_at: now })
        .eq("id", integration.id);

      return {
        success: false,
        status: "needs_reauth",
        message: "A autenticação expirou ou foi revogada remotamente. Por favor reautorize a integração.",
      };
    }

    return {
      success: false,
      status: "error",
      message: `Falha na verificação de conectividade: ${errorMsg}`,
    };
  }
}
