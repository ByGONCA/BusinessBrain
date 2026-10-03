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
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId);

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
  }
): Promise<{ messages: GmailMessageSummary[]; nextPageToken?: string; resultSizeEstimate: number }> {
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId);

  const params = new URLSearchParams();
  params.set("maxResults", String(options?.maxResults || 15));
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

  // Fetch summaries for messages in parallel (capped at 10 items for performance)
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

/**
 * Retrieves a single Gmail message with full metadata.
 */
export async function getGmailMessage(
  organizationId: string,
  messageId: string
): Promise<any> {
  const { googleFetch } = await getAuthenticatedGoogleClient(organizationId);

  const response = await googleFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`
  );

  if (!response.ok) {
    throw new Error(`Gmail API get message failed: ${response.statusText}`);
  }

  return response.json();
}
