import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { generateMicrosoftAuthUrl } from "@/lib/integrations/microsoft/oauth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

import { hasPermission } from "@/lib/permissions/resolver";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Rate limit by authenticated user ID
  const rl = await rateLimit("microsoft-connect", user.id, RATE_LIMIT_PRESETS.INTEGRATIONS);
  if (!rl.success) {
    logger.warn("Rate limit exceeded on Microsoft connect", { userId: user.id });
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=rate_limit_exceeded", request.url)
    );
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Verify permission: requires integrations.connect or Owner
  const canConnect = await hasPermission(user.id, activeOrg.id, "integrations.connect");
  if (!canConnect) {
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=insufficient_permissions", request.url)
    );
  }

  const { searchParams } = new URL(request.url);
  const serviceParam = searchParams.get("service");

  let service: "outlook" | "outlook_calendar" = "outlook_calendar";
  if (serviceParam === "outlook" || serviceParam === "mail") {
    service = "outlook";
  }

  try {
    const authUrl = generateMicrosoftAuthUrl({
      organizationId: activeOrg.id,
      userId: user.id,
      service,
      returnUrl: "/dashboard?settings=integrations",
    });

    return NextResponse.redirect(authUrl);
  } catch (err: unknown) {
    logger.error("Failed to generate Microsoft auth URL", err, {
      organizationId: activeOrg.id,
      userId: user.id,
    });
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=microsoft_not_configured", request.url)
    );
  }
}
