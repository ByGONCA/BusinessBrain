import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { verifySlackOAuthState, exchangeSlackCodeForToken } from "@/lib/integrations/slack/oauth";
import { logger } from "@/lib/security/logger";
import { sanitizeRedirectUrl } from "@/lib/security/redirects";
import { rateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { hasPermission } from "@/lib/permissions/resolver";

export async function GET(request: Request) {
  const clientIp = await getClientIp();
  const rl = await rateLimit("slack-callback", clientIp, RATE_LIMIT_PRESETS.INTEGRATIONS);
  const defaultRedirect = "/dashboard?settings=integrations";

  if (!rl.success) {
    logger.warn("Rate limit exceeded on Slack callback", { clientIp });
    return NextResponse.redirect(
      new URL(`${defaultRedirect}&error=rate_limit_exceeded`, request.url)
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    logger.warn("Slack OAuth authorization error", { error });
    return NextResponse.redirect(
      new URL(`${defaultRedirect}&error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`${defaultRedirect}&error=missing_code_or_state`, request.url)
    );
  }

  const statePayload = verifySlackOAuthState(state);
  if (!statePayload) {
    logger.warn("Invalid or expired Slack OAuth state received");
    return NextResponse.redirect(
      new URL(`${defaultRedirect}&error=invalid_state`, request.url)
    );
  }

  const user = await getCurrentUser();
  if (!user || user.id !== statePayload.userId) {
    logger.warn("User ID mismatch during Slack OAuth callback", {
      sessionUserId: user?.id,
      stateUserId: statePayload.userId,
    });
    return NextResponse.redirect(
      new URL(`${defaultRedirect}&error=user_mismatch`, request.url)
    );
  }

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", statePayload.organizationId)
    .eq("user_id", user.id)
    .single();

  const isAuthorized =
    member &&
    (member.role === "owner" ||
      member.role === "admin" ||
      (await hasPermission(user.id, statePayload.organizationId, "integrations.connect")));

  if (!isAuthorized) {
    logger.warn("User lacks permission to complete Slack connection", {
      userId: user.id,
      organizationId: statePayload.organizationId,
    });
    return NextResponse.redirect(
      new URL(`${defaultRedirect}&error=insufficient_permissions`, request.url)
    );
  }

  const returnUrl = sanitizeRedirectUrl(statePayload.returnUrl, defaultRedirect);

  try {
    const exchangeResult = await exchangeSlackCodeForToken(code, statePayload);
    if (!exchangeResult.success) {
      return NextResponse.redirect(
        new URL(
          `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}status=error&error=${encodeURIComponent(
            exchangeResult.error || "exchange_failed"
          )}`,
          request.url
        )
      );
    }

    return NextResponse.redirect(
      new URL(
        `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}status=connected&provider=slack`,
        request.url
      )
    );
  } catch (err: unknown) {
    logger.error("Failed to process Slack OAuth callback", err, {
      organizationId: statePayload.organizationId,
    });
    return NextResponse.redirect(
      new URL(
        `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}status=error&error=server_error`,
        request.url
      )
    );
  }
}
