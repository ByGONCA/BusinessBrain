import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { generateGoogleAuthUrl } from "@/lib/integrations/google/oauth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

const VALID_SERVICES = ["gmail", "google_calendar", "calendar", "google", "google_drive", "drive"] as const;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Rate limit by authenticated user ID
  const rl = await rateLimit("google-connect", user.id, RATE_LIMIT_PRESETS.INTEGRATIONS);
  if (!rl.success) {
    logger.warn("Rate limit exceeded on Google connect", { userId: user.id });
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=rate_limit_exceeded", request.url)
    );
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Only owners and admins can connect integrations
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=insufficient_permissions", request.url)
    );
  }

  const { searchParams } = new URL(request.url);
  const serviceParam = searchParams.get("service");

  // Validate service against permitted whitelist
  let service: "gmail" | "google_calendar" | "google" | "google_drive" = "google";
  if (serviceParam === "gmail") {
    service = "gmail";
  } else if (serviceParam === "calendar" || serviceParam === "google_calendar") {
    service = "google_calendar";
  } else if (serviceParam === "drive" || serviceParam === "google_drive") {
    service = "google_drive";
  }

  try {
    const authUrl = generateGoogleAuthUrl({
      organizationId: activeOrg.id,
      userId: user.id,
      service,
      returnUrl: "/dashboard?settings=integrations",
    });

    return NextResponse.redirect(authUrl);
  } catch (err: unknown) {
    logger.error("Failed to generate Google auth URL", err, {
      userId: user.id,
      organizationId: activeOrg.id,
    });
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=config_error", request.url)
    );
  }
}
