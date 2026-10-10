import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { generateGitHubAuthUrl } from "@/lib/integrations/github/oauth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Rate limit by authenticated user ID
  const rl = await rateLimit("github-connect", user.id, RATE_LIMIT_PRESETS.INTEGRATIONS);
  if (!rl.success) {
    logger.warn("Rate limit exceeded on GitHub connect", { userId: user.id });
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=rate_limit_exceeded", request.url)
    );
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Only workspace owners and admins can connect integrations
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=insufficient_permissions", request.url)
    );
  }

  const { searchParams } = new URL(request.url);
  const returnUrl = searchParams.get("returnUrl") || "/dashboard?settings=integrations";

  try {
    const authUrl = generateGitHubAuthUrl({
      organizationId: activeOrg.id,
      userId: user.id,
      returnUrl,
    });

    return NextResponse.redirect(authUrl);
  } catch (err: unknown) {
    logger.error("Failed to generate GitHub auth URL", err, {
      userId: user.id,
      organizationId: activeOrg.id,
    });
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=config_error", request.url)
    );
  }
}
