import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { getGmailAttachment, isValidGmailId } from "@/lib/integrations/google/gmail";
import { hasPermission } from "@/lib/permissions/resolver";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
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
 * Enforces session authentication, integrations.view permission, rate limiting,
 * parameter validation, and strict Content-Disposition policies.
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

    // Verify caller has permissions to view organization integrations
    const canView = await hasPermission(user.id, activeOrg.id, "integrations.view");
    if (!canView) {
      logger.warn("Unauthorized attempt to download email attachment", {
        userId: user.id,
        organizationId: activeOrg.id,
      });
      return new NextResponse("Forbidden: You do not have permission to view workspace integrations", {
        status: 403,
      });
    }

    // Rate limit attachment downloads per user
    const rl = await rateLimit("gmail-attachment-download", user.id, RATE_LIMIT_PRESETS.API_STANDARD);
    if (!rl.success) {
      logger.warn("Rate limit exceeded on attachment download", { userId: user.id });
      return new NextResponse("Too many attachment requests. Please try again shortly.", {
        status: 429,
      });
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

    // Validate ID formats to prevent path traversal or injection
    if (!isValidGmailId(messageId) || !isValidGmailId(attachmentId, 1024)) {
      logger.warn("Invalid messageId or attachmentId format in attachment request", {
        messageId,
        attachmentId,
      });
      return new NextResponse("Invalid messageId or attachmentId format", { status: 400 });
    }

    const { buffer } = await getGmailAttachment(
      activeOrg.id,
      messageId,
      attachmentId,
      accountEmail
    );

    const mimeType = getMimeType(filename);
    const isSvg = filename.toLowerCase().endsWith(".svg") || mimeType === "image/svg+xml";

    // Strictly whitelist safe inline formats (PDF and safe images only)
    const SAFE_INLINE_MIMES = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
    ];
    const isSafeInline = isInline && SAFE_INLINE_MIMES.includes(mimeType) && !isSvg;

    // Strictly force 'attachment' disposition for SVG and all non-whitelisted formats to prevent stored/reflected XSS
    const dispositionType = isSafeInline ? "inline" : "attachment";
    // Sanitize filename for HTTP header against header injection
    const cleanFilename = filename.replace(/["';\r\n\\]/g, "_");

    const responseHeaders: Record<string, string> = {
      "Content-Type": mimeType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${dispositionType}; filename="${cleanFilename}"`,
      "Cache-Control": "private, max-age=3600, no-transform",
      "X-Content-Type-Options": "nosniff",
    };

    if (isSvg || !isSafeInline) {
      responseHeaders["Content-Security-Policy"] = "default-src 'none'; sandbox";
    }

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    logger.error("Error streaming email attachment", err);
    return new NextResponse("Failed to load attachment", { status: 500 });
  }
}
