import { getAuthenticatedGoogleClient } from "./client";
import { GmailMessageSummary } from "../types";

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

/**
 * Retrieves the connected Gmail account profile (email address, message count).
 */
export async function getGmailProfile(organizationId: string): Promise<GmailProfile> {
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId, {
    service: "gmail",
  });

  const response = await googleFetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile"
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gmail API profile request failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Lists messages from the connected Gmail inbox with optional query filtering.
 */
export async function listGmailMessages(
  organizationId: string,
  options?: {
    maxResults?: number;
    query?: string;
    pageToken?: string;
    accountEmail?: string;
  }
): Promise<{ messages: GmailMessageSummary[]; nextPageToken?: string; resultSizeEstimate: number }> {
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId, {
    accountEmail: options?.accountEmail,
    service: "gmail",
  });

  const params = new URLSearchParams();
  params.set("maxResults", String(options?.maxResults || 10));
  if (options?.query) params.set("q", options.query);
  if (options?.pageToken) params.set("pageToken", options.pageToken);

  const listResponse = await googleFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`
  );

  if (!listResponse.ok) {
    const errorText = await listResponse.text();
    throw new Error(`Gmail API list messages failed (${listResponse.status}): ${errorText}`);
  }

  const listData = await listResponse.json();
  const rawList: Array<{ id: string; threadId: string }> = listData.messages || [];

  // Fetch summaries for messages in parallel (capped at exactly 10 items for inbox list performance)
  const summariesToFetch = rawList.slice(0, 10);
  const messageSummaries: GmailMessageSummary[] = await Promise.all(
    summariesToFetch.map(async (msg) => {
      try {
        const itemRes = await googleFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`
        );
        if (!itemRes.ok) return { id: msg.id, threadId: msg.threadId, snippet: "" };

        const item = await itemRes.json();
        const headers: Array<{ name: string; value: string }> = item.payload?.headers || [];

        const getHeader = (name: string) =>
          headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

        return {
          id: msg.id,
          threadId: msg.threadId,
          snippet: item.snippet || "",
          subject: getHeader("Subject") || "(No Subject)",
          from: getHeader("From"),
          to: getHeader("To"),
          date: getHeader("Date"),
          unread: (item.labelIds || []).includes("UNREAD"),
        };
      } catch {
        return {
          id: msg.id,
          threadId: msg.threadId,
          snippet: "",
        };
      }
    })
  );

  return {
    messages: messageSummaries,
    nextPageToken: listData.nextPageToken,
    resultSizeEstimate: listData.resultSizeEstimate || 0,
  };
}

export interface GmailAttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export interface GmailFullMessage {
  id: string;
  threadId: string;
  snippet: string;
  body: string;
  htmlBody?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  attachments?: GmailAttachmentMeta[];
}

interface GmailPayloadPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailPayloadPart[];
}

/**
 * Robust MIME extractor that:
 * 1. Collects all text/html and text/plain parts from any nested level.
 * 2. Fetches attachmentId bodies if the email exceeded Gmail's inline threshold (>100KB, common in legal updates like Revolut).
 * 3. Chooses the richest/largest content payload instead of blindly taking the first one (which is often just a tracking preheader).
 */
async function extractMimeContent(
  payload: GmailPayloadPart | undefined,
  messageId: string,
  googleFetch: (url: string, init?: RequestInit) => Promise<Response>
): Promise<{ text?: string; html?: string }> {
  if (!payload) return {};

  const htmlCandidates: Array<{ content: string; size: number }> = [];
  const textCandidates: Array<{ content: string; size: number }> = [];
  const pendingAttachments: Array<{ mime: string; attachmentId: string; size: number }> = [];

  function walk(part: GmailPayloadPart) {
    const mime = (part.mimeType || "").toLowerCase();
    const data = part.body?.data;
    const attachmentId = part.body?.attachmentId;

    if (data) {
      try {
        const decoded = Buffer.from(data, "base64url").toString("utf-8");
        if (mime === "text/html") {
          htmlCandidates.push({ content: decoded, size: decoded.length });
        } else if (mime === "text/plain") {
          textCandidates.push({ content: decoded, size: decoded.length });
        }
      } catch {
        // Fallback for decoding errors
      }
    } else if (attachmentId && (mime === "text/html" || mime === "text/plain")) {
      // Body content is stored as attachmentId (occurs on large emails like Revolut legal updates > 100KB)
      pendingAttachments.push({ mime, attachmentId, size: part.body?.size || 0 });
    }

    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        walk(subPart);
      }
    }
  }

  walk(payload);

  // If no HTML found inline or if an attachment is a larger text/html part, fetch the attachment body
  for (const att of pendingAttachments) {
    try {
      const attRes = await googleFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${att.attachmentId}`
      );
      if (attRes.ok) {
        const attData = await attRes.json();
        if (attData.data) {
          const decoded = Buffer.from(attData.data, "base64url").toString("utf-8");
          if (att.mime === "text/html") {
            htmlCandidates.push({ content: decoded, size: decoded.length });
          } else if (att.mime === "text/plain") {
            textCandidates.push({ content: decoded, size: decoded.length });
          }
        }
      }
    } catch {
      // Ignore attachment fetch errors
    }
  }

  // Pick the largest candidate for HTML and text (avoids picking empty tracking preheaders)
  htmlCandidates.sort((a, b) => b.size - a.size);
  textCandidates.sort((a, b) => b.size - a.size);

  return {
    html: htmlCandidates[0]?.content,
    text: textCandidates[0]?.content,
  };
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<[^>]+>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Retrieves a single Gmail message with full decoded text and HTML body.
 * Called only when an email is opened.
 */
function extractAttachments(payload: GmailPayloadPart | undefined): GmailAttachmentMeta[] {
  if (!payload) return [];
  const list: GmailAttachmentMeta[] = [];

  function walk(part: GmailPayloadPart) {
    const filename = part.filename?.trim();
    const attachmentId = part.body?.attachmentId;
    // Parts with an explicit filename and an attachmentId are downloadable files
    if (filename && filename.length > 0 && attachmentId) {
      list.push({
        filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body?.size || 0,
        attachmentId,
      });
    }

    if (part.parts && Array.isArray(part.parts)) {
      for (const sub of part.parts) {
        walk(sub);
      }
    }
  }

  walk(payload);
  return list;
}

export async function getGmailMessage(
  organizationId: string,
  messageId: string,
  accountEmail?: string
): Promise<GmailFullMessage> {
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId, {
    accountEmail,
    service: "gmail",
  });

  const response = await googleFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
  );

  if (!response.ok) {
    throw new Error(`Gmail API get message failed: ${response.statusText}`);
  }

  const data = await response.json();
  const headers: Array<{ name: string; value: string }> = data.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

  // Extract body content (both text and rich HTML, including attachments for large emails)
  const { text, html } = await extractMimeContent(data.payload, messageId, googleFetch);

  // Extract attached files (PDFs, images, docs) with zero database storage
  const attachments = extractAttachments(data.payload);

  // Guarantee complete text content: use plain text if substantial, else derive from rich HTML
  const resolvedBody =
    text && text.trim().length > 30
      ? text
      : html
      ? htmlToPlainText(html)
      : data.snippet || "";

  return {
    id: data.id,
    threadId: data.threadId || "",
    snippet: data.snippet || "",
    body: resolvedBody,
    htmlBody: html,
    subject: getHeader("Subject"),
    from: getHeader("From"),
    to: getHeader("To"),
    date: getHeader("Date"),
    attachments,
  };
}

/**
 * Streams an email attachment on demand directly from Gmail API.
 * Never saved to local disk or database. Zero storage cost.
 */
export async function getGmailAttachment(
  organizationId: string,
  messageId: string,
  attachmentId: string,
  accountEmail?: string
): Promise<{ buffer: Buffer; size: number }> {
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId, {
    accountEmail,
    service: "gmail",
  });

  const response = await googleFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`
  );

  if (!response.ok) {
    throw new Error(`Gmail API get attachment failed (${response.status}): ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.data) {
    throw new Error("No data returned for attachment");
  }

  const buffer = Buffer.from(data.data, "base64url");
  return { buffer, size: buffer.length };
}
