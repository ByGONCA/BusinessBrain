import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { getGmailAttachment } from "@/lib/integrations/google/gmail";
import { logger } from "@/lib/security/logger";

function getMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".csv")) return "text/csv; charset=utf-8";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".doc") || lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
}

/**
 * Streams an email attachment on demand directly to the browser.
 * Zero database storage, zero disk writes, 100% on-demand.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return new NextResponse("No active organization found", { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId");
    const attachmentId = searchParams.get("attachmentId");
    const filename = searchParams.get("filename") || "attachment";
    const accountEmail = searchParams.get("accountEmail") || undefined;
    const isInline = searchParams.get("inline") === "true";

    if (!messageId || !attachmentId) {
      return new NextResponse("Missing messageId or attachmentId", { status: 400 });
    }

    const { buffer } = await getGmailAttachment(
      activeOrg.id,
      messageId,
      attachmentId,
      accountEmail
    );

    const mimeType = getMimeType(filename);
    const dispositionType = isInline ? "inline" : "attachment";
    // Sanitize filename for HTTP header
    const cleanFilename = filename.replace(/["\r\n]/g, "_");

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `${dispositionType}; filename="${cleanFilename}"`,
        "Cache-Control": "private, max-age=3600, no-transform",
      },
    });
  } catch (err: unknown) {
    logger.error("Error streaming email attachment", err);
    return new NextResponse("Failed to load attachment", { status: 500 });
  }
}
