import { headers } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cleanupAbandonedUploads } from "@/lib/storage/cleanup";
import { logger } from "@/lib/security/logger";

function isAuthorized(authHeader: string | null): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;

  const validSecrets = [
    process.env.CRON_SECRET?.trim(),
    process.env.INTERNAL_MAINTENANCE_SECRET?.trim(),
  ].filter((s): s is string => Boolean(s && s.length > 0));

  if (validSecrets.length === 0) return false;

  for (const secret of validSecrets) {
    if (token.length === secret.length) {
      if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Maintenance Route: Cleanup Abandoned Uploads
 * Can be triggered via scheduled Vercel Cron or authenticated operations endpoint.
 * Protected via CRON_SECRET or INTERNAL_MAINTENANCE_SECRET Bearer header.
 */
export async function POST(req: Request) {
  const headerList = await headers();
  const authHeader = headerList.get("authorization");

  if (!isAuthorized(authHeader)) {
    logger.warn("Unauthorized cleanup maintenance invocation attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const olderThanHours = typeof body.olderThanHours === "number" ? body.olderThanHours : 2;

    const report = await cleanupAbandonedUploads({
      olderThanHours,
      useServiceClient: true,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: unknown) {
    logger.error("Maintenance cleanup route error", err);
    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 }
    );
  }
}
