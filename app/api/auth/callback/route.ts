import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserOrganizations, getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationEntitlement } from "@/lib/organizations/entitlements";
import { sanitizeRedirectUrl } from "@/lib/security/redirects";
import { rateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

export async function GET(request: Request) {
  const clientIp = await getClientIp();
  const rl = await rateLimit("auth-callback", clientIp, RATE_LIMIT_PRESETS.AUTH_STRICT);

  const { searchParams, origin } = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;

  if (!rl.success) {
    logger.warn("Rate limit exceeded on auth callback", { clientIp });
    return NextResponse.redirect(`${baseUrl}/login?error=too-many-requests`);
  }

  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const type = searchParams.get("type");
  const safeNext = sanitizeRedirectUrl(rawNext, "/dashboard");

  // Check if provider returned an authorization error (e.g. user canceled Google or GitHub consent)
  const oauthError = searchParams.get("error");
  if (oauthError) {
    logger.warn("OAuth provider returned error on callback", {
      error: oauthError,
      desc: searchParams.get("error_description"),
    });
    const errorKey = oauthError === "access_denied" ? "oauth_cancelled" : "auth-code-error";
    return NextResponse.redirect(`${baseUrl}/login?error=${errorKey}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // 1. Prioritize password recovery flow: if user arrives via reset link or recovery type,
      // route immediately to /reset-password before any organization or subscription checks.
      const isRecovery =
        safeNext.startsWith("/reset-password") ||
        type === "recovery";

      if (isRecovery) {
        return NextResponse.redirect(`${baseUrl}/reset-password`);
      }

      // Check if Multi-Factor Authentication (AAL2) is required for this account
      try {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData && aalData.currentLevel === "aal1" && aalData.nextLevel === "aal2") {
          return NextResponse.redirect(`${baseUrl}/auth/mfa?returnUrl=${encodeURIComponent(safeNext)}`);
        }
      } catch (aalErr) {
        logger.warn("Could not check MFA assurance level during OAuth callback", { error: aalErr });
      }

      // Check if user has an organization
      const organizations = await getUserOrganizations();

      if (organizations.length === 0) {
        // If the intended destination is an invitation page, allow user to accept and join workspace
        if (safeNext.startsWith("/invite/")) {
          return NextResponse.redirect(`${baseUrl}${safeNext}`);
        }
        return NextResponse.redirect(`${baseUrl}/onboarding`);
      }

      // Check active organization entitlement
      const activeOrg = await getActiveOrganization();
      if (activeOrg) {
        const entitlement = await getOrganizationEntitlement(activeOrg.id);
        if (!entitlement.isEntitled) {
          return NextResponse.redirect(`${baseUrl}/pricing?reason=subscription_required`);
        }
      }

      return NextResponse.redirect(`${baseUrl}${safeNext}`);
    } else {
      logger.warn("Supabase auth code exchange failed", { error: error.message });
    }
  }

  // Return the user to login with sanitized error parameter
  return NextResponse.redirect(`${baseUrl}/login?error=auth-code-error`);
}
