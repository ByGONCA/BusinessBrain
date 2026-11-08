import { getAuthenticatedMicrosoftClient, AuthenticatedMicrosoftClientOptions } from "./client";
import { EmailMessageItem, EmailAttachmentItem } from "../types";

export interface OutlookProfile {
  emailAddress: string;
  displayName: string;
  id: string;
}

export interface OutlookDraftInput {
  to: string | string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  accountEmail?: string;
}

export interface OutlookDraftItem {
  id: string;
  subject: string;
  to: string;
  body: string;
  updatedAt: string;
}

/**
 * Validates that an identifier does not contain path traversal, protocol injection, or whitespace.
 */
export function isValidOutlookId(id: string, maxLen = 256): boolean {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return false;
  // Allow alphanumeric, hyphen, underscore, dot, and equal sign for base64
  return /^[a-zA-Z0-9_\-\.=%]+$/.test(trimmed);
}

/**
 * Retrieves the connected Outlook account profile.
 */
export async function getOutlookProfile(organizationId: string): Promise<OutlookProfile> {
  const { microsoftFetch } = await getAuthenticatedMicrosoftClient(organizationId, {
    service: "outlook",
  });

  const response = await microsoftFetch("/me");

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Outlook profile request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    displayName: data.displayName || "",
    emailAddress: data.mail || data.userPrincipalName || "",
  };
}

/**
 * Lists messages from the connected Outlook inbox with optional query filtering and pagination.
 */
export async function listOutlookMessages(
  organizationId: string,
  options?: {
    maxResults?: number;
    query?: string;
    skipToken?: string;
    accountEmail?: string;
  }
): Promise<{ messages: EmailMessageItem[]; nextSkipToken?: string }> {
  const { microsoftFetch, accountEmail: connectedEmail } = await getAuthenticatedMicrosoftClient(
    organizationId,
    {
      accountEmail: options?.accountEmail,
      service: "outlook",
    }
  );

  const top = options?.maxResults || 10;
  const params = new URLSearchParams();
  params.set("$top", String(top));
  params.set(
    "$select",
    "id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,isRead,hasAttachments"
  );
  params.set("$orderby", "receivedDateTime desc");

  if (options?.query && options.query.trim().length > 0) {
    // Microsoft Graph KQL search
    params.set("$search", `"${options.query.trim().replace(/"/g, "")}"`);
  }
  if (options?.skipToken) {
    params.set("$skiptoken", options.skipToken);
  }

  const response = await microsoftFetch(`/me/messages?${params.toString()}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Outlook list messages failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    value?: Array<{
      id: string;
      subject?: string;
      bodyPreview?: string;
      body?: { contentType?: string; content?: string };
      from?: { emailAddress?: { name?: string; address?: string } };
      toRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
      receivedDateTime?: string;
      isRead?: boolean;
      hasAttachments?: boolean;
    }>;
    "@odata.nextLink"?: string;
  };

  const rawItems = data.value || [];

  const messages: EmailMessageItem[] = rawItems.map((item) => {
    const senderName = item.from?.emailAddress?.name || "Sender";
    const senderEmail = item.from?.emailAddress?.address || "unknown@domain.com";
    const recipients = (item.toRecipients || [])
      .map((r) => r.emailAddress?.address)
      .filter(Boolean)
      .join(", ");

    const d = item.receivedDateTime ? new Date(item.receivedDateTime) : new Date();
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const dateDisplay = isToday
      ? "Today"
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
    const timeDisplay = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return {
      id: item.id,
      sender: senderName,
      senderEmail,
      recipientEmail: recipients || connectedEmail,
      subject: item.subject || "(No Subject)",
      snippet: item.bodyPreview || "",
      body: item.body?.content || item.bodyPreview || "",
      htmlBody: item.body?.contentType?.toLowerCase() === "html" ? item.body.content : undefined,
      date: dateDisplay,
      time: timeDisplay,
      unread: !item.isRead,
      source: "Outlook",
      accountEmail: connectedEmail,
    };
  });

  let nextSkipToken: string | undefined;
  if (data["@odata.nextLink"]) {
    try {
      const nextUrl = new URL(data["@odata.nextLink"]);
      nextSkipToken = nextUrl.searchParams.get("$skiptoken") || undefined;
    } catch {
      // ignore parsing error
    }
  }

  return { messages, nextSkipToken };
}

/**
 * Retrieves a single Outlook email message with attachments list.
 */
export async function getOutlookMessage(
  organizationId: string,
  messageId: string,
  accountEmail?: string
): Promise<EmailMessageItem> {
  if (!isValidOutlookId(messageId)) {
    throw new Error("Invalid Outlook message identifier format.");
  }

  const { microsoftFetch, accountEmail: connectedEmail } = await getAuthenticatedMicrosoftClient(
    organizationId,
    {
      accountEmail,
      service: "outlook",
    }
  );

  const response = await microsoftFetch(
    `/me/messages/${encodeURIComponent(messageId)}?$expand=attachments($select=id,name,contentType,size,isInline)`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Outlook get message failed (${response.status}): ${errorText}`);
  }

  const item = (await response.json()) as {
    id: string;
    subject?: string;
    bodyPreview?: string;
    body?: { contentType?: string; content?: string };
    from?: { emailAddress?: { name?: string; address?: string } };
    toRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
    receivedDateTime?: string;
    isRead?: boolean;
    attachments?: Array<{
      id: string;
      name: string;
      contentType: string;
      size: number;
      isInline: boolean;
    }>;
  };

  const senderName = item.from?.emailAddress?.name || "Sender";
  const senderEmail = item.from?.emailAddress?.address || "unknown@domain.com";
  const recipients = (item.toRecipients || [])
    .map((r) => r.emailAddress?.address)
    .filter(Boolean)
    .join(", ");

  const d = item.receivedDateTime ? new Date(item.receivedDateTime) : new Date();
  const dateDisplay = d.toLocaleDateString([], { month: "short", day: "numeric" });
  const timeDisplay = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const attachments: EmailAttachmentItem[] = (item.attachments || [])
    .filter((att) => !att.isInline)
    .map((att) => ({
      name: att.name || "attachment",
      size: `${Math.round((att.size || 0) / 1024)} KB`,
      attachmentId: att.id,
      mimeType: att.contentType,
    }));

  return {
    id: item.id,
    sender: senderName,
    senderEmail,
    recipientEmail: recipients || connectedEmail,
    subject: item.subject || "(No Subject)",
    snippet: item.bodyPreview || "",
    body: item.body?.content || item.bodyPreview || "",
    htmlBody: item.body?.contentType?.toLowerCase() === "html" ? item.body.content : undefined,
    date: dateDisplay,
    time: timeDisplay,
    unread: !item.isRead,
    source: "Outlook",
    accountEmail: connectedEmail,
    attachments,
  };
}

/**
 * Downloads an Outlook attachment on demand directly as a Buffer.
 * Zero database persistence.
 */
export async function getOutlookAttachment(
  organizationId: string,
  messageId: string,
  attachmentId: string,
  accountEmail?: string
): Promise<{ buffer: Buffer; contentType: string; name: string }> {
  if (!isValidOutlookId(messageId) || !isValidOutlookId(attachmentId)) {
    throw new Error("Invalid messageId or attachmentId format.");
  }

  const { microsoftFetch } = await getAuthenticatedMicrosoftClient(organizationId, {
    accountEmail,
    service: "outlook",
  });

  const response = await microsoftFetch(
    `/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Outlook get attachment failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    name?: string;
    contentType?: string;
    contentBytes?: string;
  };

  if (!data.contentBytes) {
    throw new Error("Attachment content is empty or reference-only.");
  }

  const buffer = Buffer.from(data.contentBytes, "base64");
  return {
    buffer,
    contentType: data.contentType || "application/octet-stream",
    name: data.name || "attachment",
  };
}

/**
 * Creates a new email draft in the connected Outlook account using Microsoft Graph.
 * The email is NEVER sent automatically.
 */
export async function createOutlookDraft(
  organizationId: string,
  input: OutlookDraftInput,
  options?: AuthenticatedMicrosoftClientOptions
): Promise<OutlookDraftItem> {
  const recipientsList = Array.isArray(input.to) ? input.to : [input.to];
  if (recipientsList.length === 0 || !recipientsList[0]) {
    throw new Error("Recipient ('to') is required for email draft.");
  }

  const { microsoftFetch } = await getAuthenticatedMicrosoftClient(organizationId, {
    accountEmail: options?.accountEmail,
    userId: options?.userId,
    service: "outlook",
  });

  const payload = {
    subject: input.subject,
    body: {
      contentType: input.isHtml ? "HTML" : "Text",
      content: input.body,
    },
    toRecipients: recipientsList.map((addr) => ({
      emailAddress: { address: addr.trim() },
    })),
  };

  const response = await microsoftFetch("/me/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Outlook create draft failed (${response.status}): ${errorText}`);
  }

  const created = (await response.json()) as {
    id: string;
    subject?: string;
    body?: { content?: string };
    toRecipients?: Array<{ emailAddress?: { address?: string } }>;
  };

  return {
    id: created.id,
    subject: created.subject || input.subject,
    to: recipientsList.join(", "),
    body: created.body?.content || input.body,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sends an approved Outlook draft message.
 */
export async function sendOutlookDraft(
  organizationId: string,
  draftId: string,
  accountEmail?: string
): Promise<{ success: boolean }> {
  if (!isValidOutlookId(draftId)) {
    throw new Error("Invalid draft identifier.");
  }

  const { microsoftFetch } = await getAuthenticatedMicrosoftClient(organizationId, {
    accountEmail,
    service: "outlook",
  });

  const response = await microsoftFetch(`/me/messages/${encodeURIComponent(draftId)}/send`, {
    method: "POST",
  });

  if (!response.ok && response.status !== 202) {
    const errorText = await response.text();
    throw new Error(`Outlook send message failed (${response.status}): ${errorText}`);
  }

  return { success: true };
}
