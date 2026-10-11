import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { cleanupAbandonedUploads } from "@/lib/storage/cleanup";
import { logger } from "@/lib/security/logger";

/**
 * Maintenance Route: Cleanup Abandoned Uploads
 * Can be triggered via scheduled Vercel Cron or authenticated operations endpoint.
 * Protected via CRON_SECRET Bearer header.
 */
export async function POST(req: Request) {
  const headerList = await headers();
  const authHeader = headerList.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_MAINTENANCE_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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
