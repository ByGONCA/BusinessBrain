import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { createSlackOAuthState, getSlackAuthorizeUrl } from "@/lib/integrations/slack/oauth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { sanitizeRedirectUrl } from "@/lib/security/redirects";
import { hasPermission } from "@/lib/permissions/resolver";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const rl = await rateLimit("slack-connect", user.id, RATE_LIMIT_PRESETS.INTEGRATIONS);
  if (!rl.success) {
    logger.warn("Rate limit exceeded on Slack connect", { userId: user.id });
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=rate_limit_exceeded", request.url)
    );
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  const canConnect = await hasPermission(user.id, activeOrg.id, "integrations.connect");
  if (!canConnect) {
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=insufficient_permissions", request.url)
    );
  }

  const { searchParams } = new URL(request.url);
  const rawReturnUrl = searchParams.get("returnUrl");
  const returnUrl = sanitizeRedirectUrl(rawReturnUrl, "/dashboard?settings=integrations");

  try {
    const state = createSlackOAuthState({
      organizationId: activeOrg.id,
      userId: user.id,
      returnUrl,
    });

    const authorizeUrl = getSlackAuthorizeUrl(state);
    return NextResponse.redirect(authorizeUrl);
  } catch (err: unknown) {
    logger.error("Failed to generate Slack OAuth URL", err, {
      userId: user.id,
      organizationId: activeOrg.id,
    });
    return NextResponse.redirect(
      new URL("/dashboard?settings=integrations&error=config_error", request.url)
    );
  }
}
